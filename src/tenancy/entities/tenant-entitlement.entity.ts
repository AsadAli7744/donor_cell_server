import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("tenant_entitlements")
@Index(["tenant_id", "module_key"], { unique: true })
export class TenantEntitlement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int" })
  tenant_id: number;

  @Column({ type: "varchar", length: 80 })
  module_key: string;

  @Column({ type: "boolean", default: true })
  enabled: boolean;
}
