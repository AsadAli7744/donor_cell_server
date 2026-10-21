import { ForbiddenException } from "@nestjs/common";
import {
  DeleteQueryBuilder,
  InsertQueryBuilder,
  SelectQueryBuilder,
  UpdateQueryBuilder,
} from "typeorm";
import { getTenantStore } from "./tenant-context";

const PATCHED = Symbol("tenantScopePatched");

function entityHasTenant(metadata: { columns?: Array<{ propertyName: string }> } | undefined) {
  return !!metadata?.columns?.some((column) => column.propertyName === "tenant_id");
}

function applyScope(qb: {
  expressionMap: {
    aliases: Array<{ name: string; metadata?: { columns?: Array<{ propertyName: string }> } }>;
  };
  andWhere: (sql: string, params?: Record<string, unknown>) => unknown;
  [PATCHED]?: boolean;
}) {
  if (qb[PATCHED]) return;
  qb[PATCHED] = true;

  const store = getTenantStore();
  if (!store || store.mode === "unscoped") return;
  if (!store.tenantId) {
    throw new ForbiddenException("Tenant context is required");
  }

  for (const alias of qb.expressionMap.aliases) {
    if (!entityHasTenant(alias.metadata)) continue;
    const param = `tenantScope_${alias.name.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    qb.andWhere(`${alias.name}.tenant_id = :${param}`, {
      [param]: store.tenantId,
    });
  }
}

function wrap<T extends { prototype: any }>(Ctor: T, method: string) {
  const original = Ctor.prototype[method];
  if (typeof original !== "function" || original.__tenantWrapped) return;
  function wrapped(this: any, ...args: unknown[]) {
    applyScope(this);
    return original.apply(this, args);
  }
  wrapped.__tenantWrapped = true;
  Ctor.prototype[method] = wrapped;
}

let installed = false;

/** Adds tenant_id to TypeORM reads, updates, and deletes whenever a request has a tenant. */
export function installTenantQueryScope() {
  if (installed) return;
  installed = true;

  for (const method of [
    "getMany",
    "getOne",
    "getRawMany",
    "getRawOne",
    "getCount",
    "getManyAndCount",
    "getExists",
    "execute",
  ]) {
    wrap(SelectQueryBuilder, method);
  }
  wrap(UpdateQueryBuilder, "execute");
  wrap(DeleteQueryBuilder, "execute");

  const originalInsert = InsertQueryBuilder.prototype.execute;
  if (!(originalInsert as { __tenantWrapped?: boolean }).__tenantWrapped) {
    function wrappedInsert(this: InsertQueryBuilder<any>, ...args: unknown[]) {
      const store = getTenantStore();
      if (store?.mode === "required" && store.tenantId) {
        const expression = this.expressionMap;
        const values = expression.valuesSet;
        const stamp = (row: Record<string, unknown> | null | undefined) => {
          if (!row || typeof row !== "object") return;
          if (row.tenant_id == null) row.tenant_id = store.tenantId;
        };
        if (Array.isArray(values)) values.forEach(stamp);
        else stamp(values as Record<string, unknown>);
      }
      return originalInsert.apply(this, args);
    }
    (wrappedInsert as { __tenantWrapped?: boolean }).__tenantWrapped = true;
    InsertQueryBuilder.prototype.execute = wrappedInsert as typeof originalInsert;
  }
}
