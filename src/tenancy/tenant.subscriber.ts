import { ForbiddenException } from "@nestjs/common";
import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from "typeorm";
import { getTenantStore } from "./tenant-context";

@EventSubscriber()
export class TenantSubscriber implements EntitySubscriberInterface {
  async beforeInsert(event: InsertEvent<any>) {
    await this.enforce(event);
  }

  async beforeUpdate(event: UpdateEvent<any>) {
    await this.enforce(event);
  }

  private async enforce(event: InsertEvent<any> | UpdateEvent<any>) {
    const entity = event.entity as Record<string, unknown> | undefined;
    const metadata = event.metadata;
    if (!entity || !metadata.columns.some((column) => column.propertyName === "tenant_id")) {
      return;
    }

    const store = getTenantStore();
    if (!store || store.mode === "unscoped") return;

    if (!store.tenantId) {
      throw new ForbiddenException("Tenant context is required");
    }

    if (
      entity.tenant_id != null &&
      Number(entity.tenant_id) !== Number(store.tenantId)
    ) {
      throw new ForbiddenException("Cross-tenant write blocked");
    }
    entity.tenant_id = store.tenantId;

    for (const relation of metadata.relations) {
      if (!relation.isManyToOne) continue;
      const inverseHasTenant = relation.inverseEntityMetadata.columns.some(
        (column) => column.propertyName === "tenant_id",
      );
      if (!inverseHasTenant) continue;
      const join = relation.joinColumns?.[0];
      if (!join) continue;
      const raw = entity[join.propertyName] ?? entity[relation.propertyName];
      const fkValue =
        raw && typeof raw === "object" ? (raw as { id?: unknown }).id : raw;
      if (fkValue == null || fkValue === "") continue;

      const table = relation.inverseEntityMetadata.tableName;
      const pk =
        relation.inverseEntityMetadata.primaryColumns[0]?.databaseName || "id";
      const rows = await event.manager.query(
        `SELECT tenant_id FROM "${table}" WHERE "${pk}" = $1 LIMIT 1`,
        [fkValue],
      );
      if (!rows?.length || rows[0].tenant_id == null) continue;
      if (Number(rows[0].tenant_id) !== Number(store.tenantId)) {
        throw new ForbiddenException(
          `Cannot link ${relation.propertyName} from another organization`,
        );
      }
    }
  }
}
