import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PermissionsModule } from "../permissions/permissions.module";
import { DataSource } from "typeorm";
import { TenantEntitlement } from "./entities/tenant-entitlement.entity";
import { TenantMembership } from "./entities/tenant-membership.entity";
import { PlatformAuditLog } from "./entities/platform-audit-log.entity";
import { TenantSetting } from "./entities/tenant-setting.entity";
import { Tenant } from "./entities/tenant.entity";
import { EntitlementGuard } from "./entitlement.guard";
import { CurrentTenantController, PlatformTenantsController } from "./platform.controller";
import { installTenantQueryScope } from "./tenant-scope";
import { TenantSubscriber } from "./tenant.subscriber";
import { TenantJobRunner } from "./tenant-jobs";
import { TenancyMiddleware } from "./tenancy.middleware";
import { TenancyService } from "./tenancy.service";

installTenantQueryScope();

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      TenantMembership,
      TenantEntitlement,
      TenantSetting,
      PlatformAuditLog,
    ]),
    PermissionsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "your-secret-key",
      signOptions: { expiresIn: "24h" },
    }),
  ],
  controllers: [PlatformTenantsController, CurrentTenantController],
  providers: [
    TenancyService,
    TenancyMiddleware,
    TenantJobRunner,
    EntitlementGuard,
    { provide: APP_GUARD, useClass: EntitlementGuard },
  ],
  exports: [TenancyService, TenantJobRunner],
})
export class TenancyModule implements NestModule {
  constructor(private readonly dataSource: DataSource) {
    if (!this.dataSource.subscribers.some((sub) => sub instanceof TenantSubscriber)) {
      this.dataSource.subscribers.push(new TenantSubscriber());
    }
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenancyMiddleware).forRoutes("*");
  }
}
