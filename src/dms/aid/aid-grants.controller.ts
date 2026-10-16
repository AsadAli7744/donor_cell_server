import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { JwtGuard } from "../../auth/jwt.guard";
import {
  AID_APPLICATIONS_DELIVER_GUARD,
  AID_APPLICATIONS_UPDATE_GUARD,
  AID_APPLICATIONS_VIEW_GUARD,
  AID_PEOPLE_UPDATE_GUARD,
  AID_PEOPLE_VIEW_GUARD,
} from "../../permissions/aid-permissions.constants";
import {
  DONATION_UPDATE_GUARD,
  DONATION_VIEW_GUARD,
} from "../../permissions/donation-permissions.constants";
import { RequiredPermissions } from "../../permissions/decorators/require-permission.decorator";
import { PermissionsGuard } from "../../permissions/guards/permissions.guard";
import { AidGrantsService, CreateAidGrantInput } from "./aid-grants.service";

const VIEW_GUARD = [
  ...AID_APPLICATIONS_VIEW_GUARD,
  ...AID_PEOPLE_VIEW_GUARD,
  ...DONATION_VIEW_GUARD,
];

const WRITE_GUARD = [
  ...AID_APPLICATIONS_UPDATE_GUARD,
  ...AID_APPLICATIONS_DELIVER_GUARD,
  ...AID_PEOPLE_UPDATE_GUARD,
  ...DONATION_UPDATE_GUARD,
];

@Controller("aid/grants")
@UseGuards(JwtGuard, PermissionsGuard)
export class AidGrantsController {
  constructor(private readonly grantsService: AidGrantsService) {}

  @Get()
  @RequiredPermissions(VIEW_GUARD)
  async list(
    @Query("donation_id") donationId: string,
    @Query("beneficiary_person_id") personId: string,
    @Query("application_id") applicationId: string,
    @Res() res: Response,
  ) {
    const data = await this.grantsService.list({
      donation_id: this.optionalId(donationId),
      beneficiary_person_id: this.optionalId(personId),
      application_id: this.optionalId(applicationId),
    });
    return res.status(HttpStatus.OK).json({
      success: true,
      message: "Grants retrieved",
      ...data,
    });
  }

  @Get("applications")
  @RequiredPermissions(VIEW_GUARD)
  async applications(
    @Query("beneficiary_person_id") personId: string,
    @Res() res: Response,
  ) {
    const id = this.optionalId(personId);
    const data = id ? await this.grantsService.applicationOptions(id) : [];
    return res.status(HttpStatus.OK).json({
      success: true,
      data,
    });
  }

  @Post()
  @RequiredPermissions(WRITE_GUARD)
  async create(
    @Body() body: CreateAidGrantInput,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const data = await this.grantsService.create(body, req?.user);
    return res.status(HttpStatus.CREATED).json({
      success: true,
      message: "Donation granted to beneficiary",
      data,
    });
  }

  @Delete(":id")
  @RequiredPermissions(WRITE_GUARD)
  async remove(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const data = await this.grantsService.remove(id, req?.user);
    return res.status(HttpStatus.OK).json({
      success: true,
      message: "Grant removed",
      data,
    });
  }

  private optionalId(value?: string) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
}
