import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum TenantStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
}

@Entity("tenants")
export class Tenant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 160 })
  name: string;

  @Column({ type: "varchar", length: 80, unique: true })
  slug: string;

  @Column({ type: "varchar", length: 20, default: TenantStatus.ACTIVE })
  status: TenantStatus;

  /** Browser Origin that should resolve to this tenant, for example https://give.example.org */
  @Column({ type: "varchar", length: 255, nullable: true })
  primary_host: string | null;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updated_at: Date;
}
