import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
} from "typeorm";

/**
 * Stored donors count per month (month-wise).
 * This is derived from unique donors "seen" in that month (any donation attempt).
 */
@Entity("dashboard_donor_monthly_count")
@Index("idx_dashboard_donor_monthly_count_month", ["month_start_date"])
export class DashboardDonorMonthlyCount {
  @Index()
  @Column({ type: "int", name: "tenant_id", nullable: true })
  tenant_id: number | null;

  @PrimaryColumn({ type: "date" })
  month_start_date: Date;

  @Column({
    type: "bigint",
    default: 0,
    transformer: { from: (v) => Number(v ?? 0), to: (v) => String(v ?? 0) },
  })
  donors_count: number;
}
