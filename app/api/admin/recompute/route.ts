import { recomputeBalances } from "@/lib/ledger";
import { ok } from "@/lib/api";

// GET = dry run (report drift). POST = apply corrections. Both require a session
// (enforced by middleware). Used by the "Recheck balances" button on the Accounts page.
export async function GET() {
  const diffs = await recomputeBalances(false);
  return ok({ drifted: diffs.length, diffs }, "Balance check complete");
}

export async function POST() {
  const diffs = await recomputeBalances(true);
  return ok(
    { corrected: diffs.length, diffs },
    diffs.length ? `Corrected ${diffs.length} account balance(s)` : "All balances already match"
  );
}
