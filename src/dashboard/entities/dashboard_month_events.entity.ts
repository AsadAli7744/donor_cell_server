import {
  Entity,
  Index,
  PrimaryColumn,
  Column,
} from "typeorm";

/**
 * Optional month→event mapping.
 * Tracks which events had donations in which months.
 */
@Entity("dashboard_month_events")
@Index("idx_dashboard_month_events_month", ["month_start_date"])
export class DashboardMonthEvents {
  @Index()
  @Column({ type: "int", name: "tenant_id", nullable: true })
  tenant_id: number | null;

  @PrimaryColumn({ type: "date" })
  month_start_date: Date;

  @PrimaryColumn({ type: "bigint" })
  event_id: number;
}
