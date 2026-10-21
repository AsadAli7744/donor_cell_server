import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("platform_audit_logs")
export class PlatformAuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 80 })
  action: string;

  @Column({ type: "int", nullable: true })
  tenant_id: number | null;

  @Column({ type: "jsonb", nullable: true })
  detail: Record<string, unknown> | null;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date;
}
