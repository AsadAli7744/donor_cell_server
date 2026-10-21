/** Permission roots and sidebar group ids that can be turned off per tenant. */
export const TENANT_MODULE_KEYS = [
  "fund_raising",
  "admin",
  "geographic",
  "hr",
  "program",
  "tasking",
  "tickets",
  "tasks",
  "communication",
  "email_templates",
  "progress_tracking",
  "store",
  "procurements",
  "accounts_and_finance",
  "it",
  "marketing",
  "ceo_office",
] as const;

export type TenantModuleKey = (typeof TENANT_MODULE_KEYS)[number];

/** Longest prefix wins. Unlisted routes stay available. */
export const ROUTE_MODULE_PREFIXES: Array<[string, TenantModuleKey]> = [
  ["/accounts-and-finance", "accounts_and_finance"],
  ["/website-donation-projects", "fund_raising"],
  ["/website-home-hero", "fund_raising"],
  ["/recurring-donations", "fund_raising"],
  ["/manual-recurring-pledges", "fund_raising"],
  ["/donations-summary", "fund_raising"],
  ["/donation-box-donation", "fund_raising"],
  ["/donation-in-kind", "fund_raising"],
  ["/donation-box", "fund_raising"],
  ["/receipt-templates", "communication"],
  ["/email-templates", "communication"],
  ["/job_applications", "hr"],
  ["/resume-collection", "hr"],
  ["/progress", "progress_tracking"],
  ["/procurements", "procurements"],
  ["/reconciliation", "fund_raising"],
  ["/donations", "fund_raising"],
  ["/campaigns", "fund_raising"],
  ["/appeals", "fund_raising"],
  ["/events", "fund_raising"],
  ["/donors", "fund_raising"],
  ["/volunteers", "communication"],
  ["/communication", "communication"],
  ["/geographic", "geographic"],
  ["/countries", "geographic"],
  ["/regions", "geographic"],
  ["/sub-regions", "geographic"],
  ["/districts", "geographic"],
  ["/tehsils", "geographic"],
  ["/cities", "geographic"],
  ["/routes", "geographic"],
  ["/program", "program"],
  ["/tickets", "tickets"],
  ["/tasks", "tasking"],
  ["/store", "store"],
  ["/jobs", "hr"],
  ["/careers", "hr"],
  ["/aid", "fund_raising"],
];

export const WEBHOOK_PREFIXES = [
  "/donations/public/stripe/webhook",
  "/donations/public/jazzcash/ipn",
  "/donations/public/alfalah/listener",
  "/donations/public/payfast/ipn",
  "/donations/public/blinq/callback",
  "/donations/public/meezan",
  "/email/public/resend/webhook",
];

/** Origins that belong to the original organization until a tenant sets primary_host. */
export const DEFAULT_TENANT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3001",
  "http://localhost:3000",
  "http://localhost:3002",
  "https://donation.mtjfoundation.org",
  "https://mtjf-erp.vercel.app",
  "https://mtjf-site.vercel.app",
  "https://www.mtjfoundation.org",
  "https://mtjfoundation.org",
  "https://erp.mtjfoundation.pk",
];

export const GLOBAL_UNIQUE_COLUMNS = new Set([
  "donation_public_id",
  "api_key",
  "stripe_invoice_id",
  "stripe_event_id",
  "public_tracking_token",
]);
