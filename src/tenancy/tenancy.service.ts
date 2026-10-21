import { ForbiddenException, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { UserRole } from "../users/user.entity";
import {
  DEFAULT_TENANT_ORIGINS,
  GLOBAL_UNIQUE_COLUMNS,
  TENANT_MODULE_KEYS,
} from "./tenant.constants";
import { TenantEntitlement } from "./entities/tenant-entitlement.entity";
import { MembershipKind, TenantMembership } from "./entities/tenant-membership.entity";
import { PlatformAuditLog } from "./entities/platform-audit-log.entity";
import { TenantSetting } from "./entities/tenant-setting.entity";
import { Tenant, TenantStatus } from "./entities/tenant.entity";
import {
  mergeDonationBoxLabels,
  sanitizeDonationBoxLabelOverrides,
} from "./donation-box-field-labels";
import { TenantJobRunner, TenantJobs } from "./tenant-jobs";
import { runUnscoped } from "./tenant-context";

type CachedTenant = {
  id: number;
  slug: string;
  name: string;
  status: TenantStatus;
  primary_host: string | null;
};

@Injectable()
export class TenancyService implements OnModuleInit {
  private readonly logger = new Logger(TenancyService.name);
  private cache: CachedTenant[] = [];
  private entitlements = new Map<string, boolean>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly jobs: TenantJobRunner,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(TenantMembership)
    private readonly memberships: Repository<TenantMembership>,
    @InjectRepository(TenantEntitlement)
    private readonly entitlementRows: Repository<TenantEntitlement>,
    @InjectRepository(PlatformAuditLog)
    private readonly audits: Repository<PlatformAuditLog>,
    @InjectRepository(TenantSetting)
    private readonly settings: Repository<TenantSetting>,
  ) {}

  async onModuleInit() {
    TenantJobs.runner = this.jobs;
    await runUnscoped(async () => {
      await this.ensurePrimaryTenant();
      await this.backfillTenantIds();
      await this.ensureMemberships();
      await this.ensureEntitlements();
      await this.dropObsoleteSingleColumnUniques();
    });
    await this.refreshCache();
    this.logger.log(
      `Tenant scope ready. Primary tenant id ${this.defaultTenantId() ?? "missing"}.`,
    );
  }

  defaultTenantId(): number | null {
    return this.cache[0]?.id ?? null;
  }

  async refreshCache() {
    return runUnscoped(async () => {
      await this.loadCache();
    });
  }

  private async loadCache() {
    const rows = await this.tenants.find({ order: { id: "ASC" } });
    this.cache = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      status: row.status,
      primary_host: row.primary_host,
    }));
    const grants = await this.entitlementRows.find();
    this.entitlements = new Map(
      grants.map((row) => [`${row.tenant_id}:${row.module_key}`, row.enabled]),
    );
  }

  listTenants(): CachedTenant[] {
    return this.cache;
  }

  getCached(id: number): CachedTenant | undefined {
    return this.cache.find((row) => row.id === id);
  }

  resolveOrigin(origin: string | undefined): number | null {
    const normalized = this.normalizeOrigin(origin);
    if (normalized) {
      const match = this.cache.find(
        (row) => this.normalizeOrigin(row.primary_host) === normalized,
      );
      if (match) return match.id;
      if (this.isBuiltInOrigin(normalized)) return this.defaultTenantId();
      return null;
    }
    return this.defaultTenantId();
  }

  isActive(tenantId: number | null): boolean {
    if (!tenantId) return false;
    const tenant = this.getCached(tenantId);
    return !!tenant && tenant.status === TenantStatus.ACTIVE;
  }

  isModuleEnabled(tenantId: number | null, moduleKey: string): boolean {
    if (!tenantId) return false;
    if (!TENANT_MODULE_KEYS.includes(moduleKey as (typeof TENANT_MODULE_KEYS)[number])) {
      return true;
    }
    const value = this.entitlements.get(`${tenantId}:${moduleKey}`);
    return value !== false;
  }

  enabledModuleMap(tenantId: number): Record<string, boolean> {
    const map: Record<string, boolean> = {};
    for (const key of TENANT_MODULE_KEYS) {
      map[key] = this.isModuleEnabled(tenantId, key);
    }
    return map;
  }

  clampPermissionTree(
    tenantId: number,
    permissions: Record<string, any>,
  ): Record<string, any> {
    const next = { ...(permissions || {}) };
    for (const key of Object.keys(next)) {
      if (!this.isModuleEnabled(tenantId, key)) {
        delete next[key];
      }
    }
    return next;
  }

  async donationBoxLabels(tenantId: number) {
    this.assertTenant(tenantId);
    const row = await this.settings.findOne({
      where: { tenant_id: tenantId, setting_key: "donation_box_field_labels" },
    });
    return mergeDonationBoxLabels(row?.setting_value as Record<string, unknown>);
  }

  async setDonationBoxLabels(tenantId: number, input: Record<string, unknown>) {
    this.assertTenant(tenantId);
    const setting_value = sanitizeDonationBoxLabelOverrides(input);
    const existing = await this.settings.findOne({
      where: { tenant_id: tenantId, setting_key: "donation_box_field_labels" },
    });
    if (existing) {
      existing.setting_value = setting_value;
      await this.settings.save(existing);
    } else {
      await this.settings.save(
        this.settings.create({
          tenant_id: tenantId,
          setting_key: "donation_box_field_labels",
          setting_value,
        }),
      );
    }
    return mergeDonationBoxLabels(setting_value);
  }

  private assertTenant(tenantId: number) {
    if (!Number.isFinite(tenantId) || tenantId <= 0) {
      throw new ForbiddenException("Tenant required");
    }
  }

  async ensureMembership(userId: number, tenantId: number, role?: string) {
    const existing = await this.memberships.findOne({
      where: { user_id: userId, tenant_id: tenantId },
    });
    if (existing) return existing;
    return this.memberships.save(
      this.memberships.create({
        user_id: userId,
        tenant_id: tenantId,
        kind: this.kindForRole(role),
      }),
    );
  }

  async createTenant(input: { name: string; slug: string; primary_host?: string | null }) {
    return runUnscoped(async () => {
    const tenant = await this.tenants.save(
      this.tenants.create({
        name: input.name,
        slug: input.slug,
        primary_host: input.primary_host || null,
        status: TenantStatus.ACTIVE,
      }),
    );
    await this.ensureEntitlementsFor(tenant.id);
    await this.audits.save(
      this.audits.create({
        action: "tenant.created",
        tenant_id: tenant.id,
        detail: { slug: tenant.slug },
      }),
    );
    await this.loadCache();
    return tenant;
    });
  }

  async setStatus(tenantId: number, status: TenantStatus) {
    return runUnscoped(async () => {
    await this.tenants.update(tenantId, { status });
    await this.audits.save(
      this.audits.create({
        action: status === TenantStatus.SUSPENDED ? "tenant.suspended" : "tenant.reactivated",
        tenant_id: tenantId,
        detail: { status },
      }),
    );
    await this.loadCache();
    });
  }

  async setEntitlements(tenantId: number, modules: Record<string, boolean>) {
    return runUnscoped(async () => {
    for (const [moduleKey, enabled] of Object.entries(modules)) {
      if (!TENANT_MODULE_KEYS.includes(moduleKey as (typeof TENANT_MODULE_KEYS)[number])) {
        continue;
      }
      const existing = await this.entitlementRows.findOne({
        where: { tenant_id: tenantId, module_key: moduleKey },
      });
      if (existing) {
        existing.enabled = !!enabled;
        await this.entitlementRows.save(existing);
      } else {
        await this.entitlementRows.save(
          this.entitlementRows.create({
            tenant_id: tenantId,
            module_key: moduleKey,
            enabled: !!enabled,
          }),
        );
      }
    }
    await this.audits.save(
      this.audits.create({
        action: "tenant.entitlements_updated",
        tenant_id: tenantId,
        detail: modules,
      }),
    );
    await this.loadCache();
    });
  }

  private async ensurePrimaryTenant() {
    const existing = await this.tenants.find({ order: { id: "ASC" }, take: 1 });
    if (existing.length) return existing[0];
    return this.tenants.save(
      this.tenants.create({
        name: "Primary Organization",
        slug: "primary",
        status: TenantStatus.ACTIVE,
        primary_host: null,
      }),
    );
  }

  private async backfillTenantIds() {
    const primary = await this.tenants.find({ order: { id: "ASC" }, take: 1 });
    const tenantId = primary[0]?.id;
    if (!tenantId) return;
    const tables = await this.dataSource.query(
      `SELECT table_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'tenant_id'`,
    );
    const skip = new Set([
      "tenants",
      "tenant_memberships",
      "tenant_entitlements",
      "tenant_settings",
      "platform_audit_logs",
    ]);
    for (const row of tables) {
      const table = row.table_name as string;
      if (skip.has(table)) continue;
      await this.dataSource.query(
        `UPDATE "${table}" SET tenant_id = $1 WHERE tenant_id IS NULL`,
        [tenantId],
      );
    }
  }

  private async ensureMemberships() {
    const users = await this.dataSource.query(
      `SELECT id, tenant_id, role FROM "user" WHERE tenant_id IS NOT NULL`,
    );
    for (const user of users) {
      await this.ensureMembership(Number(user.id), Number(user.tenant_id), user.role);
    }
  }

  private async ensureEntitlements() {
    const tenants = await this.tenants.find();
    for (const tenant of tenants) {
      await this.ensureEntitlementsFor(tenant.id);
    }
  }

  private async ensureEntitlementsFor(tenantId: number) {
    for (const moduleKey of TENANT_MODULE_KEYS) {
      const existing = await this.entitlementRows.findOne({
        where: { tenant_id: tenantId, module_key: moduleKey },
      });
      if (!existing) {
        await this.entitlementRows.save(
          this.entitlementRows.create({
            tenant_id: tenantId,
            module_key: moduleKey,
            enabled: true,
          }),
        );
      }
    }
  }

  private async dropObsoleteSingleColumnUniques() {
    const indexes = await this.dataSource.query(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND indexdef ILIKE 'CREATE UNIQUE INDEX%'`,
    );
    const perTenantColumns = new Set([
      "email",
      "referral_code",
      "name",
      "code",
      "slug",
      "box_id_no",
      "price_date",
      "application_no",
      "cnic",
      "complaint_code",
      "pass_code",
    ]);
    for (const index of indexes) {
      const name = String(index.indexname);
      const def = String(index.indexdef);
      if (name.endsWith("_pkey") || def.includes("tenant_id")) continue;
      const columns = [...def.matchAll(/\(([^)]+)\)/g)].pop()?.[1] || "";
      const parts = columns.split(",").map((part) => part.replace(/"/g, "").trim());
      if (parts.length !== 1) continue;
      if (GLOBAL_UNIQUE_COLUMNS.has(parts[0])) continue;
      if (!perTenantColumns.has(parts[0])) continue;
      await this.dataSource.query(`DROP INDEX IF EXISTS "${name}"`);
      this.logger.log(`Dropped global unique index ${name}`);
    }
  }

  private kindForRole(role?: string): MembershipKind {
    if (role === UserRole.SUPER_ADMIN) return MembershipKind.OWNER;
    if (role === UserRole.ADMIN || role === UserRole.SYSTEM_ADMIN) return MembershipKind.ADMIN;
    return MembershipKind.MEMBER;
  }

  private normalizeOrigin(value: string | null | undefined): string | null {
    if (!value) return null;
    return value.toLowerCase().replace(/\/$/, "");
  }

  private isBuiltInOrigin(origin: string): boolean {
    if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
      return true;
    }
    return DEFAULT_TENANT_ORIGINS.map((item) => this.normalizeOrigin(item)).includes(origin);
  }
}
