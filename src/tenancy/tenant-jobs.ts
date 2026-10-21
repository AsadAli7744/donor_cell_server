import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import { TenantStatus } from "./entities/tenant.entity";
import { runWithTenant } from "./tenant-context";

@Injectable()
export class TenantJobRunner {
  private readonly logger = new Logger(TenantJobRunner.name);

  constructor(private readonly dataSource: DataSource) {}

  async runForEachActiveTenant<T>(work: () => Promise<T>): Promise<T[]> {
    const tenants = await this.dataSource.query(
      `SELECT id FROM tenants WHERE status = $1 ORDER BY id`,
      [TenantStatus.ACTIVE],
    );
    const results: T[] = [];
    for (const tenant of tenants) {
      try {
        const value = await runWithTenant(Number(tenant.id), () => work());
        results.push(value);
      } catch (error) {
        this.logger.error(
          `Tenant ${tenant.id} job failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return results;
  }
}

/** Set during startup so cron methods can loop tenants without a new constructor dependency. */
export class TenantJobs {
  static runner: TenantJobRunner | null = null;
}
