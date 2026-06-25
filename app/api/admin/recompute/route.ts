import { recomputeBalances } from "@/lib/ledger";
import { ok } from "@/lib/api";
import { logActivity } from "@/lib/activity";

// GET = dry run (report drift). POST = apply corrections. Both require a session
// (enforced by middleware). Used by the "Recheck balances" button on the Accounts page.
export async function GET() {
  const diffs = await recomputeBalances(false);
  return ok({ drifted: diffs.length, diffs }, "Balance check complete");
}

export async function POST() {
  const diffs = await recomputeBalances(true);
  if (diffs.length) {
    await logActivity({
      action: "recompute",
      entity: "system",
      title: `Rechecked balances — corrected ${diffs.length} account${diffs.length === 1 ? "" : "s"}`,
      meta: { corrected: diffs.map((d) => ({ name: d.name, delta: d.delta })) },
    });
  }
  return ok(
    { corrected: diffs.length, diffs },
    diffs.length ? `Corrected ${diffs.length} account balance(s)` : "All balances already match"
  );
}
