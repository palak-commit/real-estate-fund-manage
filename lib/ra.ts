// Running Account (RA) bill receipt math — the single source of truth for how a stored
// receipt's raw inputs expand into the full "Receipt of RA" register (mirrors the Excel
// sheet). Pure + shared by the page so the table and its totals can never diverge.
//
// Only the inputs (amount + the manual deductions) are persisted; every figure below is
// derived from those inputs and the current (page-editable) rate set.

export type RaRates = {
  gst: number; // GST charged on the bill amount (%)
  tds: number; // TDS on amount (%)
  tdsGst: number; // TDS on GST, computed on the bill amount (%)
  sd: number; // Security Deposit (%)
  cess: number; // Workman cess (%)
  subletGst: number; // GST on the sub-let bill (%)
};

// Defaults match the Excel sheet's column headers / sample figures.
export const DEFAULT_RA_RATES: RaRates = {
  gst: 12,
  tds: 1,
  tdsGst: 2,
  sd: 5,
  cess: 1,
  subletGst: 12,
};

export type RaInput = {
  amount: number;
  withheld_amt: number;
  royalty: number;
  agency_charge: number;
  sub_let_bill: number;
};

export type RaComputed = {
  gst: number;
  total_bill: number;
  tds: number;
  tds_gst: number;
  sd: number;
  cess: number;
  total_deduction: number;
  cheque_amt: number;
  net_receivable: number;
  sub_let_bill: number; // effective value (defaults to Net Receivable when not entered)
  sub_gst: number;
};

const pct = (base: number, rate: number) => (Number(base) || 0) * (Number(rate) || 0) / 100;

// The authoritative Net Receivable for a receipt: derived from its inputs (+ an optional
// partial rate set, merged over the defaults) and rounded to whole paisa, clamped to ≥ 0.
// The server uses this instead of trusting the client-sent net_receivable.
export function netReceivableFrom(i: RaInput, rates?: Partial<RaRates>): number {
  const net = computeRa(i, { ...DEFAULT_RA_RATES, ...(rates ?? {}) }).net_receivable;
  return Math.max(0, Math.round(net * 100) / 100);
}

export function computeRa(i: RaInput, r: RaRates): RaComputed {
  const amount = Number(i.amount) || 0;
  const gst = pct(amount, r.gst);
  const total_bill = amount + gst;
  const tds = pct(amount, r.tds);
  const tds_gst = pct(amount, r.tdsGst);
  const sd = pct(amount, r.sd);
  const cess = pct(amount, r.cess);
  const total_deduction = tds + tds_gst + sd + cess + (Number(i.withheld_amt) || 0) + (Number(i.royalty) || 0);
  const cheque_amt = total_bill - total_deduction;
  const net_receivable = cheque_amt - (Number(i.agency_charge) || 0);
  // Sub Let Bill defaults to the Net Receivable (as in the Excel sheet) unless one is entered.
  const sub_let_bill = (Number(i.sub_let_bill) || 0) > 0 ? Number(i.sub_let_bill) : net_receivable;
  const sub_gst = pct(sub_let_bill, r.subletGst);
  return { gst, total_bill, tds, tds_gst, sd, cess, total_deduction, cheque_amt, net_receivable, sub_let_bill, sub_gst };
}
