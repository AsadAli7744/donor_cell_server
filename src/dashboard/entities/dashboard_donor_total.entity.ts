import {
  Column,
  Entity,
  PrimaryColumn,
  Index,
} from "typeorm";

/**
 * Stored total donors count (all time).
 * We update this when a donor is first "seen" (i.e., created via register/auto-register).
 */
@Entity("dashboard_donor_total")
export class DashboardDonorTotal {
  @Index()
  @Column({ type: "int", name: "tenant_id", nullable: true })
  tenant_id: number | null;

  @PrimaryColumn({ type: "int" })
  id: number;

  @Column({
    type: "bigint",
    default: 0,
    transformer: { from: (v) => Number(v ?? 0), to: (v) => String(v ?? 0) },
  })
  total_donors_count: number;
}
