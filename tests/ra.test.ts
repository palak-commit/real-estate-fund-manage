import { describe, it, expect } from "vitest";
import { computeRa, DEFAULT_RA_RATES } from "@/lib/ra";

const base = { amount: 0, withheld_amt: 0, royalty: 0, agency_charge: 0, sub_let_bill: 0 };

describe("computeRa — matches the Excel 'Receipt of RA' sheet", () => {
  it("row 1: ₹10,00,000 at default rates", () => {
    const c = computeRa({ ...base, amount: 1_000_000 }, DEFAULT_RA_RATES);
    expect(c.gst).toBe(120_000);
    expect(c.total_bill).toBe(1_120_000);
    expect(c.tds).toBe(10_000);
    expect(c.tds_gst).toBe(20_000);
    expect(c.sd).toBe(50_000);
    expect(c.cess).toBe(10_000);
    expect(c.total_deduction).toBe(90_000);
    expect(c.cheque_amt).toBe(1_030_000);
    expect(c.net_receivable).toBe(1_030_000);
    // Sub Let Bill defaults to Net Receivable; Sub-GST is 12% of it.
    expect(c.sub_let_bill).toBe(1_030_000);
    expect(c.sub_gst).toBe(123_600);
  });

  it("row 2: ₹15,00,000 at default rates", () => {
    const c = computeRa({ ...base, amount: 1_500_000 }, DEFAULT_RA_RATES);
    expect(c.net_receivable).toBe(1_545_000);
    expect(c.sub_gst).toBe(185_400);
  });

  it("withheld, royalty and agency charge reduce the net receivable", () => {
    const c = computeRa(
      { amount: 1_000_000, withheld_amt: 5_000, royalty: 3_000, agency_charge: 2_000, sub_let_bill: 0 },
      DEFAULT_RA_RATES
    );
    // 1,030,000 − 5,000 − 3,000 (extra deductions) − 2,000 (agency) = 1,020,000
    expect(c.net_receivable).toBe(1_020_000);
  });

  it("an explicit Sub Let Bill overrides the Net-Receivable default", () => {
    const c = computeRa({ ...base, amount: 1_000_000, sub_let_bill: 500_000 }, DEFAULT_RA_RATES);
    expect(c.sub_let_bill).toBe(500_000);
    expect(c.sub_gst).toBe(60_000); // 12% of 500,000
  });

  it("custom rates recompute every column", () => {
    const c = computeRa({ ...base, amount: 1_000_000 }, { ...DEFAULT_RA_RATES, gst: 18, tds: 2 });
    expect(c.gst).toBe(180_000);
    expect(c.total_bill).toBe(1_180_000);
    expect(c.tds).toBe(20_000);
  });
});
