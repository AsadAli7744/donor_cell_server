import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ROUTE_MODULE_PREFIXES, WEBHOOK_PREFIXES } from "./tenant.constants";
import { currentTenantId, getTenantStore } from "./tenant-context";
import { TenancyService } from "./tenancy.service";

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(private readonly tenancy: TenancyService) {}

  canActivate(context: ExecutionContext): boolean {
    const store = getTenantStore();
    if (!store || store.mode === "unscoped") return true;

    const request = context.switchToHttp().getRequest();
    const path = String(request.originalUrl || request.url || "").split("?")[0];
    if (WEBHOOK_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
    if (path.startsWith("/platform") || path.startsWith("/auth") || path.startsWith("/donor-auth")) {
      return true;
    }

    const match = ROUTE_MODULE_PREFIXES.find(([prefix]) => path.startsWith(prefix));
    if (!match) return true;

    const tenantId = currentTenantId();
    if (!tenantId) return true;
    if (!this.tenancy.isModuleEnabled(tenantId, match[1])) {
      throw new ForbiddenException({
        statusCode: 403,
        message: "This module is not enabled for your organization",
        code: "MODULE_DISABLED",
      });
    }
    return true;
  }
}
