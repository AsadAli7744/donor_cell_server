import {
  Entity,
  Index,
  PrimaryColumn,
  Column,
} from "typeorm";

/**
 * Uniqueness table for donors seen at least once (any donation attempt).
 * PK (donor_id) ensures we only increment total donors once.
 */
@Entity("dashboard_donor_seen")
@Index("idx_dashboard_donor_seen_donor", ["donor_id"])
export class DashboardDonorSeen {
  @Index()
  @Column({ type: "int", name: "tenant_id", nullable: true })
  tenant_id: number | null;

  @PrimaryColumn({ type: "bigint" })
  donor_id: number;
}
