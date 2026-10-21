import { User } from "../../../users/user.entity";
import {
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  Index,
} from "typeorm";

export abstract class BaseEntity {
  @PrimaryGeneratedColumn("increment")
  id: number;

  /**
   * Owning organization. Nullable so synchronize can add the column on
   * existing databases; startup backfill sets tenant 1, and request scope
   * rejects writes that omit it.
   */
  @Index()
  @Column({ type: "int", name: "tenant_id", nullable: true })
  tenant_id: number | null;

  // Basic audit fields
  @Column({ type: "boolean", default: false })
  is_archived: boolean;

  @ManyToOne(() => User, (user) => user.id, {
    nullable: true,
    eager: false,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "created_by" })
  created_by: User;

  @ManyToOne(() => User, (user) => user.id, {
    nullable: true,
    eager: false,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "updated_by" })
  updated_by: User;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  updated_at: Date;
}
