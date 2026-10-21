import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export enum MembershipKind {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
}

@Entity("tenant_memberships")
@Index(["tenant_id", "user_id"], { unique: true })
export class TenantMembership {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int" })
  tenant_id: number;

  @Column({ type: "int" })
  user_id: number;

  @Column({ type: "varchar", length: 20, default: MembershipKind.MEMBER })
  kind: MembershipKind;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date;
}
