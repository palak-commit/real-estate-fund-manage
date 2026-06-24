import { pool, query } from "@/lib/db";

// THE single definition of how a transaction moves money between accounts.
// Used by BOTH the write path (api/transactions) and the reconciler below, so the
// live balance and the recomputed-from-ledger balance can never diverge.
//
// Site funds are derived (see lib/queries), so they are NOT represented here —
// only real account balances are mutated.
export type AccountDelta = { accountId: number; delta: number };

type TxnLike = {
  type: string;
  amount: number | string;
  source_account_id: number | null;
  dest_account_id: number | null;
};

export function accountEffects(t: TxnLike): AccountDelta[] {
  const A = Number(t.amount);
  const S = t.source_account_id;
  const D = t.dest_account_id;
  const out: AccountDelta[] = [];
  switch (t.type) {
    case "transfer":
      if (S) out.push({ accountId: S, delta: -A });
      if (D) out.push({ accountId: D, delta: +A }); // else → site funds (derived)
      break;
    case "expense":
      if (S) out.push({ accountId: S, delta: -A }); // else → drawn from site funds (derived)
      break;
    case "income":
      if (D) out.push({ accountId: D, delta: +A }); // else → site funds (derived)
      break;
    case "partner_contribution":
      if (S) out.push({ accountId: S, delta: +A }); // money added to the partner account
      break;
    case "partner_withdrawal":
      // The partner takes money out of their own account.
      if (S) out.push({ accountId: S, delta: -A });
      break;
  }
  return out;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type BalanceDiff = { id: number; name: string; stored: number; correct: number; delta: number };

/**
 * Recompute every account balance from opening_balance + the full transaction ledger.
 * Returns the accounts whose stored balance drifted from the ledger. When `apply` is
 * true, the drifted balances are corrected atomically.
 */
export async function recomputeBalances(apply: boolean): Promise<BalanceDiff[]> {
  const accounts = await query<{ id: number; name: string; opening_balance: number; current_balance: number }>(
    "SELECT id, name, opening_balance, current_balance FROM accounts"
  );
  const txns = await query<TxnLike>(
    "SELECT type, amount, source_account_id, dest_account_id FROM transactions"
  );

  const expected = new Map<number, number>();
  for (const a of accounts) expected.set(a.id, Number(a.opening_balance));
  for (const t of txns) {
    for (const e of accountEffects(t)) {
      expected.set(e.accountId, (expected.get(e.accountId) ?? 0) + e.delta);
    }
  }

  const diffs: BalanceDiff[] = accounts
    .map((a) => {
      const stored = Number(a.current_balance);
      const correct = round2(expected.get(a.id) ?? 0);
      return { id: a.id, name: a.name, stored, correct, delta: round2(correct - stored) };
    })
    .filter((d) => Math.abs(d.delta) > 0.005);

  if (apply && diffs.length) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const d of diffs) {
        await conn.query("UPDATE accounts SET current_balance = ? WHERE id = ?", [d.correct, d.id]);
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  return diffs;
}
