import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../../utils/base_utils/entities/baseEntity";
import { Donation } from "../../../donations/entities/donation.entity";
import { AidApplication } from "./aid-application.entity";
import { AidPerson } from "./aid-person.entity";

/**
 * A slice of a completed donation granted to a beneficiary.
 * One donation can fund many people. One person can be funded by many donations.
 * application_id is optional: set it when the money is for a specific case.
 */
@Entity("aid_grants")
@Index("idx_aid_grant_donation", ["donation_id"])
@Index("idx_aid_grant_beneficiary", ["beneficiary_person_id"])
@Index("idx_aid_grant_application", ["application_id"])
export class AidGrant extends BaseEntity {
  @Column({ type: "int" })
  donation_id: number;

  @ManyToOne(() => Donation, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "donation_id" })
  donation: Donation;

  @Column({ type: "int" })
  beneficiary_person_id: number;

  @ManyToOne(() => AidPerson, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "beneficiary_person_id" })
  beneficiary: AidPerson;

  @Column({ type: "int", nullable: true, default: null })
  application_id: number | null;

  @ManyToOne(() => AidApplication, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "application_id" })
  application: AidApplication | null;

  /** Whole currency units, same scale as donations.amount. */
  @Column({ type: "int" })
  amount: number;

  @Column({ type: "varchar", length: 12, nullable: true, default: null })
  currency: string | null;

  @Column({ type: "text", nullable: true, default: null })
  note: string | null;

  @Column({ type: "timestamptz", nullable: true, default: null })
  granted_at: Date | null;
}
