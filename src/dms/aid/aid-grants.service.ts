import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Donation } from "../../donations/entities/donation.entity";
import { User } from "../../users/user.entity";
import { AidApplication } from "./entities/aid-application.entity";
import { AidGrant } from "./entities/aid-grant.entity";
import { AidPerson } from "./entities/aid-person.entity";

export type CreateAidGrantInput = {
  donation_id?: number;
  beneficiary_person_id?: number;
  application_id?: number | null;
  amount?: number;
  note?: string | null;
};

@Injectable()
export class AidGrantsService {
  constructor(
    @InjectRepository(AidGrant)
    private readonly grantRepo: Repository<AidGrant>,
    @InjectRepository(Donation)
    private readonly donationRepo: Repository<Donation>,
    @InjectRepository(AidPerson)
    private readonly personRepo: Repository<AidPerson>,
    @InjectRepository(AidApplication)
    private readonly appRepo: Repository<AidApplication>,
  ) {}

  async list(filters: {
    donation_id?: number;
    beneficiary_person_id?: number;
    application_id?: number;
  }) {
    const qb = this.grantRepo
      .createQueryBuilder("g")
      .leftJoinAndSelect("g.donation", "donation")
      .leftJoinAndSelect("donation.donor", "donor")
      .leftJoinAndSelect("g.beneficiary", "beneficiary")
      .leftJoinAndSelect("g.application", "application")
      .where("g.is_archived = :archived", { archived: false })
      .orderBy("g.granted_at", "DESC")
      .addOrderBy("g.id", "DESC")
      .take(200);

    if (filters.donation_id) {
      qb.andWhere("g.donation_id = :donationId", {
        donationId: filters.donation_id,
      });
    }
    if (filters.beneficiary_person_id) {
      qb.andWhere("g.beneficiary_person_id = :personId", {
        personId: filters.beneficiary_person_id,
      });
    }
    if (filters.application_id) {
      qb.andWhere("g.application_id = :applicationId", {
        applicationId: filters.application_id,
      });
    }

    const rows = await qb.getMany();
    const summary = filters.donation_id
      ? await this.balance(filters.donation_id)
      : {
          allocated: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
        };

    return {
      data: rows.map((row) => this.map(row)),
      summary,
    };
  }

  async applicationOptions(personId: number) {
    const person = await this.personRepo.findOne({
      where: { id: personId, is_archived: false },
      select: ["id"],
    });
    if (!person) throw new NotFoundException(`Person #${personId} not found`);
    const rows = await this.appRepo.find({
      where: { beneficiary_person_id: personId, is_archived: false },
      order: { created_at: "DESC" },
      take: 50,
    });
    return rows.map((row) => ({
      id: row.id,
      application_no: row.application_no,
      status: row.status,
      requested_aid_type: row.requested_aid_type,
    }));
  }

  async create(input: CreateAidGrantInput, user?: User) {
    const donationId = Number(input.donation_id);
    const personId = Number(input.beneficiary_person_id);
    const amount = Math.round(Number(input.amount));
    if (!Number.isFinite(donationId) || donationId <= 0) {
      throw new BadRequestException("donation_id is required");
    }
    if (!Number.isFinite(personId) || personId <= 0) {
      throw new BadRequestException("beneficiary_person_id is required");
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("amount must be greater than 0");
    }

    const donation = await this.donationRepo.findOne({
      where: { id: donationId, is_archived: false },
    });
    if (!donation) throw new NotFoundException(`Donation #${donationId} not found`);
    const status = String(donation.status || "").toLowerCase();
    if (status !== "completed") {
      throw new BadRequestException(
        "Only a completed donation can be granted to a beneficiary",
      );
    }

    const person = await this.personRepo.findOne({
      where: { id: personId, is_archived: false },
    });
    if (!person) throw new NotFoundException(`Person #${personId} not found`);

    let applicationId: number | null = null;
    if (input.application_id != null && String(input.application_id).trim() !== "") {
      applicationId = Number(input.application_id);
      if (!Number.isFinite(applicationId) || applicationId <= 0) {
        throw new BadRequestException("application_id is invalid");
      }
      const app = await this.appRepo.findOne({
        where: { id: applicationId, is_archived: false },
      });
      if (!app) {
        throw new NotFoundException(`Application #${applicationId} not found`);
      }
      if (app.beneficiary_person_id !== personId) {
        throw new BadRequestException(
          "This application belongs to a different beneficiary",
        );
      }
    }

    const pool = this.fundPool(donation);
    const already = await this.allocatedAmount(donationId);
    const remaining = pool - already;
    if (amount > remaining) {
      throw new BadRequestException(
        `This donation has ${remaining} left to grant (pool ${pool}, already granted ${already})`,
      );
    }

    const saved = await this.grantRepo.save(
      this.grantRepo.create({
        donation_id: donationId,
        beneficiary_person_id: personId,
        application_id: applicationId,
        amount,
        currency: donation.currency || null,
        note: input.note?.trim() || null,
        granted_at: new Date(),
        created_by: user || null,
        updated_by: user || null,
      }),
    );
    return this.findMapped(saved.id);
  }

  async remove(id: number, user?: User) {
    const row = await this.grantRepo.findOne({
      where: { id, is_archived: false },
    });
    if (!row) throw new NotFoundException(`Grant #${id} not found`);
    row.is_archived = true;
    row.updated_by = user || null;
    await this.grantRepo.save(row);
    return { id };
  }

  private async findMapped(id: number) {
    const row = await this.grantRepo.findOne({
      where: { id },
      relations: ["donation", "donation.donor", "beneficiary", "application"],
    });
    if (!row) throw new NotFoundException(`Grant #${id} not found`);
    return this.map(row);
  }

  private async balance(donationId: number) {
    const donation = await this.donationRepo.findOne({
      where: { id: donationId, is_archived: false },
    });
    if (!donation) {
      return { donation_id: donationId, pool: 0, allocated: 0, remaining: 0 };
    }
    const pool = this.fundPool(donation);
    const allocated = await this.allocatedAmount(donationId);
    return {
      donation_id: donationId,
      currency: donation.currency || null,
      pool,
      allocated,
      remaining: Math.max(0, pool - allocated),
    };
  }

  private async allocatedAmount(donationId: number) {
    const raw = await this.grantRepo
      .createQueryBuilder("g")
      .select("COALESCE(SUM(g.amount), 0)", "total")
      .where("g.donation_id = :donationId", { donationId })
      .andWhere("g.is_archived = :archived", { archived: false })
      .getRawOne();
    return Number(raw?.total || 0);
  }

  private fundPool(donation: Donation) {
    const paid = Number(donation.paid_amount);
    if (Number.isFinite(paid) && paid > 0) return paid;
    const amount = Number(donation.amount);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
  }

  private map(row: AidGrant) {
    const donation = row.donation;
    const donor = donation?.donor as
      | { name?: string; first_name?: string; last_name?: string }
      | undefined;
    const donorName =
      donor?.name ||
      [donor?.first_name, donor?.last_name].filter(Boolean).join(" ") ||
      null;
    return {
      id: row.id,
      amount: Number(row.amount) || 0,
      currency: row.currency,
      note: row.note,
      granted_at: row.granted_at,
      donation: donation
        ? {
            id: donation.id,
            amount: donation.amount,
            paid_amount: donation.paid_amount,
            status: donation.status,
            currency: donation.currency,
            date: donation.date,
            donor_name: donorName,
          }
        : null,
      beneficiary: row.beneficiary
        ? {
            id: row.beneficiary.id,
            full_name: row.beneficiary.full_name,
            cnic: row.beneficiary.cnic,
          }
        : null,
      application: row.application
        ? {
            id: row.application.id,
            application_no: row.application.application_no,
            status: row.application.status,
            requested_aid_type: row.application.requested_aid_type,
          }
        : null,
    };
  }
}
