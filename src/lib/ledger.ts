/*
 * Fictitious ledger rows for the decorative scrolling strip on the landing
 * page. Nothing here is a real counterparty: the descriptions are generic
 * activity labels ("Payroll run", "Merchant deposit"), never a person or a
 * named vendor.
 *
 * `kind` drives the row tint (see `.ledger-row` in app/globals.css):
 *   income   -> green  @ 30%   (money in)
 *   expense  -> red    @ 20%   (business expense / COGS / payroll)
 *   other    -> yellow @ 25%   (taxes, transfers, everything else)
 */

export type LedgerKind = "income" | "expense" | "other";

export interface LedgerRow {
  /** Days before "today" — resolved to a real date on the client. */
  daysAgo: number;
  /** What the line item is. Never a real counterparty name. */
  label: string;
  /** Signed cents-free dollars; negative renders in parentheses. */
  amount: number;
  /** Tax treatment shown in the last column. */
  bracket: string;
  kind: LedgerKind;
}

export const LEDGER_ROWS: readonly LedgerRow[] = [
  { daysAgo: 0, label: "Merchant deposit — cards", amount: 34024, bracket: "Income", kind: "income" },
  { daysAgo: 0, label: "Payroll run, semi-monthly", amount: -120204, bracket: "Payroll", kind: "expense" },
  { daysAgo: 1, label: "Payroll taxes disbursed", amount: -23344, bracket: "Taxes Paid", kind: "other" },
  { daysAgo: 1, label: "Office furniture", amount: -17994, bracket: "Office Expense", kind: "expense" },
  { daysAgo: 2, label: "Client retainer — Q3", amount: 88500, bracket: "Income", kind: "income" },
  { daysAgo: 3, label: "Raw materials inbound", amount: -41880, bracket: "Cost of Goods", kind: "expense" },
  { daysAgo: 4, label: "Estimated federal tax, Q3", amount: -52000, bracket: "Taxes Paid", kind: "other" },
  { daysAgo: 5, label: "Wholesale invoice settled", amount: 26740, bracket: "Income", kind: "income" },
  { daysAgo: 6, label: "Cloud infrastructure", amount: -8412, bracket: "Business Expense", kind: "expense" },
  { daysAgo: 7, label: "Contract fabrication run", amount: -63150, bracket: "Cost of Goods", kind: "expense" },
  { daysAgo: 8, label: "Owner draw — transfer out", amount: -30000, bracket: "Distribution", kind: "other" },
  { daysAgo: 9, label: "Marketplace payout", amount: 19318, bracket: "Income", kind: "income" },
  { daysAgo: 10, label: "Commercial lease", amount: -14500, bracket: "Rent Expense", kind: "expense" },
  { daysAgo: 11, label: "State sales tax remitted", amount: -9877, bracket: "Taxes Paid", kind: "other" },
  { daysAgo: 12, label: "Freight & logistics", amount: -6204, bracket: "Cost of Goods", kind: "expense" },
  { daysAgo: 13, label: "Payroll run, semi-monthly", amount: -118960, bracket: "Payroll", kind: "expense" },
  { daysAgo: 14, label: "Subscription revenue", amount: 47205, bracket: "Income", kind: "income" },
  { daysAgo: 15, label: "Health benefits, group", amount: -21470, bracket: "Payroll", kind: "expense" },
  { daysAgo: 16, label: "Equipment, depreciable", amount: -28900, bracket: "Capitalized", kind: "other" },
  { daysAgo: 17, label: "Consulting fee received", amount: 15600, bracket: "Income", kind: "income" },
  { daysAgo: 18, label: "Professional services", amount: -7250, bracket: "Business Expense", kind: "expense" },
  { daysAgo: 19, label: "Packaging & fulfillment", amount: -11035, bracket: "Cost of Goods", kind: "expense" },
  { daysAgo: 20, label: "Interest earned, operating", amount: 1284, bracket: "Income", kind: "income" },
  { daysAgo: 21, label: "Business insurance", amount: -19400, bracket: "Business Expense", kind: "expense" },
  { daysAgo: 22, label: "Transfer in — reserve", amount: 75000, bracket: "Transfer", kind: "other" },
  { daysAgo: 23, label: "Contractor invoices, 1099", amount: -34820, bracket: "Payroll", kind: "expense" },
  { daysAgo: 24, label: "Retail storefront settlement", amount: 22940, bracket: "Income", kind: "income" },
  { daysAgo: 25, label: "Utilities & connectivity", amount: -3612, bracket: "Office Expense", kind: "expense" },
  { daysAgo: 26, label: "Unemployment tax deposit", amount: -4188, bracket: "Taxes Paid", kind: "other" },
  { daysAgo: 27, label: "Licensing royalty received", amount: 12750, bracket: "Income", kind: "income" },
];

/** `2026/09/09` — zero-padded, slash-separated, matching the ledger mock. */
export function formatLedgerDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}/${p(date.getMonth() + 1)}/${p(date.getDate())}`;
}

/** `$34,024` for money in, `($120,204)` for money out. */
export function formatLedgerAmount(amount: number): string {
  const magnitude = Math.abs(amount).toLocaleString("en-US");
  return amount < 0 ? `($${magnitude})` : `$${magnitude}`;
}
