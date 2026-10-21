import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { timingSafeEqual } from "crypto";
import { Request } from "express";
import { JwtGuard } from "../auth/jwt.guard";
import { PermissionsGuard } from "../permissions/guards/permissions.guard";
import { RequiredPermissions } from "../permissions/decorators/require-permission.decorator";
import { TenantStatus } from "./entities/tenant.entity";
import { currentTenantId } from "./tenant-context";
import { TenancyService } from "./tenancy.service";

function platformKeyOk(header: string | undefined): boolean {
  const expected = process.env.PLATFORM_ADMIN_KEY;
  if (!expected || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

@Controller("platform/tenants")
export class PlatformTenantsController {
  constructor(private readonly tenancy: TenancyService) {}

  @Get()
  list(@Headers("x-platform-key") key?: string) {
    this.assertKey(key);
    return { success: true, data: this.tenancy.listTenants() };
  }

  @Post()
  async create(
    @Headers("x-platform-key") key: string | undefined,
    @Body() body: { name: string; slug: string; primary_host?: string | null },
  ) {
    this.assertKey(key);
    const tenant = await this.tenancy.createTenant(body);
    return { success: true, data: tenant };
  }

  @Patch(":id/status")
  async status(
    @Headers("x-platform-key") key: string | undefined,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { status: TenantStatus },
  ) {
    this.assertKey(key);
    await this.tenancy.setStatus(id, body.status);
    return { success: true };
  }

  @Put(":id/entitlements")
  async entitlements(
    @Headers("x-platform-key") key: string | undefined,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { modules: Record<string, boolean> },
  ) {
    this.assertKey(key);
    await this.tenancy.setEntitlements(id, body.modules || {});
    return { success: true, data: this.tenancy.enabledModuleMap(id) };
  }

  private assertKey(key: string | undefined) {
    if (!platformKeyOk(key)) {
      throw new UnauthorizedException("Platform administrator key required");
    }
  }
}

@Controller("tenants")
export class CurrentTenantController {
  constructor(private readonly tenancy: TenancyService) {}

  @Get("current/donation-box-labels")
  @UseGuards(JwtGuard)
  async donationBoxLabels(@Req() req: Request) {
    const tenantId = currentTenantId() || Number((req as any).user?.tenant_id);
    const data = await this.tenancy.donationBoxLabels(tenantId);
    return { success: true, data };
  }

  @Put("current/donation-box-labels")
  @UseGuards(JwtGuard, PermissionsGuard)
  @RequiredPermissions([
    "fund_raising.donation_box.update",
    "super_admin",
    "fund_raising_manager",
  ])
  async setDonationBoxLabels(
    @Req() req: Request,
    @Body() body: { labels?: Record<string, unknown> },
  ) {
    const tenantId = currentTenantId() || Number((req as any).user?.tenant_id);
    const data = await this.tenancy.setDonationBoxLabels(tenantId, body?.labels || {});
    return { success: true, data };
  }

  @Get("current")
  @UseGuards(JwtGuard)
  current(@Req() req: Request) {
    const tenantId = currentTenantId() || Number((req as any).user?.tenant_id);
    const tenant = this.tenancy.getCached(tenantId);
    return {
      success: true,
      data: tenant
        ? {
            ...tenant,
            modules: this.tenancy.enabledModuleMap(tenant.id),
          }
        : null,
    };
  }
}
