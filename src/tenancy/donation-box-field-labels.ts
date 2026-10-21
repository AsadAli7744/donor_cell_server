/** Stable field keys. Tenants override the display text only. */
export const DONATION_BOX_FIELD_LABELS: Record<string, string> = {
  box_id_no: "Box ID",
  key_no: "Key Number",
  box_type: "Box Type",
  shop_name: "Shop Name",
  shopkeeper: "Shopkeeper",
  cell_no: "Cell Number",
  landmark_marketplace: "Landmark / Marketplace",
  frequency: "Collection Frequency",
};

const MAX_LABEL_LENGTH = 60;

export function mergeDonationBoxLabels(
  overrides: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const merged = { ...DONATION_BOX_FIELD_LABELS };
  if (!overrides || typeof overrides !== "object") return merged;
  for (const key of Object.keys(DONATION_BOX_FIELD_LABELS)) {
    const value = overrides[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    merged[key] = trimmed.slice(0, MAX_LABEL_LENGTH);
  }
  return merged;
}

export function sanitizeDonationBoxLabelOverrides(
  input: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const clean: Record<string, string> = {};
  if (!input || typeof input !== "object") return clean;
  for (const key of Object.keys(DONATION_BOX_FIELD_LABELS)) {
    const value = input[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || trimmed === DONATION_BOX_FIELD_LABELS[key]) continue;
    clean[key] = trimmed.slice(0, MAX_LABEL_LENGTH);
  }
  return clean;
}
