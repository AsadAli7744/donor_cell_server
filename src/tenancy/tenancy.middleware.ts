import { ForbiddenException, Injectable, NestMiddleware } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { NextFunction, Request, Response } from "express";
import { WEBHOOK_PREFIXES } from "./tenant.constants";
import { tenantStorage } from "./tenant-context";
import { TenancyService } from "./tenancy.service";

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly tenancy: TenancyService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const path = (req.originalUrl || req.url || "").split("?")[0];
    if (WEBHOOK_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      tenantStorage.run({ tenantId: null, mode: "unscoped" }, () => next());
      return;
    }

    const secret = process.env.JWT_SECRET || "your-secret-key";
    let tenantId: number | null = null;
    const staffToken = req.cookies?.jwt;
    const donorToken = req.cookies?.donor_jwt;
    try {
      if (staffToken) {
        const payload = this.jwtService.verify(staffToken, { secret });
        tenantId = payload?.tenant_id ? Number(payload.tenant_id) : null;
      } else if (donorToken) {
        const payload = this.jwtService.verify(donorToken, { secret });
        tenantId = payload?.tenant_id ? Number(payload.tenant_id) : null;
      }
    } catch {
      tenantId = null;
    }

    if (!tenantId) {
      tenantId = this.tenancy.resolveOrigin(req.headers.origin as string | undefined);
    }

    if (tenantId && !this.tenancy.isActive(tenantId) && !path.startsWith("/auth/logout")) {
      next(new ForbiddenException({
        statusCode: 403,
        message: "This organization is suspended",
        code: "TENANT_SUSPENDED",
      }));
      return;
    }

    const openAuth =
      path.startsWith("/auth/login") ||
      path.startsWith("/auth/forgot-password") ||
      path.startsWith("/donor-auth/login");

    if (openAuth && !req.headers.origin) {
      tenantStorage.run({ tenantId: null, mode: "unscoped" }, () => next());
      return;
    }

    tenantStorage.run(
      { tenantId: tenantId ?? null, mode: tenantId ? "required" : "required" },
      () => next(),
    );
  }
}
