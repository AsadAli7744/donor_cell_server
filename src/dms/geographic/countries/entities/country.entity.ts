import { Entity, Column, OneToMany, Index } from "typeorm";
import { BaseEntity } from "../../../../utils/base_utils/entities/baseEntity";
import { Region } from "../../regions/entities/region.entity";

@Entity("countries")
@Index("idx_country_code", ["code"])
@Index("idx_country_name", ["name"])
@Index(["tenant_id", "code"], { unique: true })
@Index(["tenant_id", "name"], { unique: true })
export class Country extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ length: 3 })
  code: string;

  @Column({ length: 3, default: "USD" })
  currency: string;

  @Column({ length: 2, nullable: true })
  currency_symbol: string;

  @Column({ length: 10, nullable: true })
  phone_code: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: "text", nullable: true })
  description: string;

  // Relationships
  @OneToMany(() => Region, (region) => region.country, { cascade: true })
  regions: Region[];
}
