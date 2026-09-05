import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toCsv, csvResponse } from "@/lib/csv";
import { WEEKDAY_NAMES } from "@/lib/verti-block";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireManager();
  const supabase = await createClient();

  const [{ data: weeks }, { data: days }, { data: types }] = await Promise.all([
    supabase
      .from("verti_production_weeks")
      .select("id, week_commencing, operator_name")
      .order("week_commencing"),
    supabase
      .from("verti_production_days")
      .select(
        "week_id, weekday, day_date, concrete_ordered_m3, counts, broken, waste_concrete_m3, block_visual_ok, mould_visual_ok, weight_ok",
      ),
    supabase
      .from("verti_block_types")
      .select("id, name, sort_order")
      .order("sort_order")
      .order("name"),
  ]);

  const weekOf = new Map(
    (weeks ?? []).map((w) => [w.id, w]),
  );
  const orderedTypes = types ?? [];

  const tick = (v: boolean | null | undefined) =>
    v == null ? "" : v ? "OK" : "NOT OK";

  const rows: (string | number | null)[][] = [];
  for (const d of (days ?? []).slice().sort((a, b) => {
    const wa = weekOf.get(a.week_id)?.week_commencing ?? "";
    const wb = weekOf.get(b.week_id)?.week_commencing ?? "";
    return wa === wb ? a.weekday - b.weekday : wa < wb ? -1 : 1;
  })) {
    const w = weekOf.get(d.week_id);
    const counts = (d.counts ?? {}) as Record<string, number>;
    const broken = (d.broken ?? {}) as Record<string, number>;
    rows.push([
      w?.week_commencing ?? "",
      WEEKDAY_NAMES[d.weekday - 1] ?? d.weekday,
      d.day_date,
      w?.operator_name ?? "",
      d.concrete_ordered_m3 ?? "",
      ...orderedTypes.map((t) => counts[t.id] ?? 0),
      ...orderedTypes.map((t) => broken[t.id] ?? 0),
      d.waste_concrete_m3 ?? "",
      tick(d.block_visual_ok),
      tick(d.mould_visual_ok),
      tick(d.weight_ok),
    ]);
  }

  const csv = toCsv(
    [
      "Week commencing",
      "Day",
      "Date",
      "Operator",
      "Concrete ordered (m³)",
      ...orderedTypes.map((t) => `Made: ${t.name}`),
      ...orderedTypes.map((t) => `Broken: ${t.name}`),
      "Waste concrete (m³)",
      "Block visual",
      "Mould visual",
      "Weight",
    ],
    rows,
  );
  const today = new Date().toISOString().slice(0, 10);
  return csvResponse(`verti-block-production-${today}.csv`, csv);
}
