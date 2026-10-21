import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("tenant_settings")
@Index(["tenant_id", "setting_key"], { unique: true })
export class TenantSetting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int" })
  tenant_id: number;

  @Column({ type: "varchar", length: 120 })
  setting_key: string;

  @Column({ type: "jsonb", nullable: true })
  setting_value: Record<string, unknown> | null;
}
