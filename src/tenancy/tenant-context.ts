import { AsyncLocalStorage } from "async_hooks";

export type TenantMode = "required" | "unscoped";

export type TenantStore = {
  tenantId: number | null;
  mode: TenantMode;
};

export const tenantStorage = new AsyncLocalStorage<TenantStore>();

export function getTenantStore(): TenantStore | undefined {
  return tenantStorage.getStore();
}

export function currentTenantId(): number | null {
  return tenantStorage.getStore()?.tenantId ?? null;
}

export function runWithTenant<T>(tenantId: number, fn: () => T): T {
  return tenantStorage.run({ tenantId, mode: "required" }, fn);
}

export function runUnscoped<T>(fn: () => T): T {
  return tenantStorage.run({ tenantId: null, mode: "unscoped" }, fn);
}
