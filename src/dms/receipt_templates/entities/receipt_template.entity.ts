import { Entity, Column, Index } from "typeorm";
import { BaseEntity } from "../../../utils/base_utils/entities/baseEntity";

@Entity("receipt_templates")
@Index(["tenant_id", "name"], { unique: true })
export class ReceiptTemplate extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: "text" })
  raw_html: string;
}
