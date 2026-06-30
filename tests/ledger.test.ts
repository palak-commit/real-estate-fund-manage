import { describe, it, expect } from "vitest";
import { accountEffects, toPaisa, toRupees } from "@/lib/ledger";

const tx = (over: Partial<Parameters<typeof accountEffects>[0]>) =>
  ({ type: "transfer", amount: 0, source_account_id: null, dest_account_id: null, ...over });

describe("accountEffects — the single source of truth for balance movement", () => {
  it("transfer between two accounts: source −, dest +", () => {
    expect(accountEffects(tx({ type: "transfer", amount: 1000, source_account_id: 1, dest_account_id: 2 }))).toEqual([
      { accountId: 1, delta: -1000 },
      { accountId: 2, delta: 1000 },
    ]);
  });

  it("site-fund allocation (transfer, no dest): only the source account drops", () => {
    expect(accountEffects(tx({ type: "transfer", amount: 1000, source_account_id: 1 }))).toEqual([
      { accountId: 1, delta: -1000 },
    ]);
  });

  it("expense from an account lowers it; expense from site funds touches no account", () => {
    expect(accountEffects(tx({ type: "expense", amount: 500, source_account_id: 3 }))).toEqual([
      { accountId: 3, delta: -500 },
    ]);
    expect(accountEffects(tx({ type: "expense", amount: 500 }))).toEqual([]);
  });

  it("income credits the dest account; income with no dest touches no account", () => {
    expect(accountEffects(tx({ type: "income", amount: 750, dest_account_id: 4 }))).toEqual([
      { accountId: 4, delta: 750 },
    ]);
    expect(accountEffects(tx({ type: "income", amount: 750 }))).toEqual([]);
  });

  it("partner_withdrawal lowers the source; partner_contribution raises it", () => {
    expect(accountEffects(tx({ type: "partner_withdrawal", amount: 200, source_account_id: 5 }))).toEqual([
      { accountId: 5, delta: -200 },
    ]);
    expect(accountEffects(tx({ type: "partner_contribution", amount: 200, source_account_id: 5 }))).toEqual([
      { accountId: 5, delta: 200 },
    ]);
  });
});

describe("paisa helpers avoid float drift", () => {
  it("rounds rupees to integer paisa and back", () => {
    expect(toPaisa(10.1)).toBe(1010);
    expect(toPaisa(0.1 + 0.2)).toBe(30); // 0.30000000000000004 → 30 paisa
    expect(toRupees(1010)).toBe(10.1);
  });
});
