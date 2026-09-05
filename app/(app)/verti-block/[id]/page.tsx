import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager, canProduction } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import type { VbDay, VbType } from "@/lib/verti-block";
import { ConfirmButton } from "@/components/confirm-button";
import { WeekSheet } from "../week-sheet";
import { deleteWeek } from "../actions";

export const dynamic = "force-dynamic";

export default async function WeekPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { roles } = await requireUser();
  if (!canProduction(roles)) {
    redirect("/dashboard");
  }
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: week }, { data: days }, { data: types }] = await Promise.all([
    supabase
      .from("verti_production_weeks")
      .select("id, week_commencing, operator_name, notes")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("verti_production_days")
      .select(
        "id, week_id, weekday, day_date, concrete_ordered_m3, counts, broken, waste_concrete_m3, blocks_broken, block_visual_ok, mould_visual_ok, weight_ok",
      )
      .eq("week_id", id)
      .order("weekday"),
    supabase
      .from("verti_block_types")
      .select("id, name, sort_order, active")
      .eq("active", true)
      .order("sort_order")
      .order("name"),
  ]);

  if (!week) notFound();

  return (
    <>
      <Link className="link-back" href="/verti-block">
        ← Verti-Block production
      </Link>
      <div className="page-head">
        <h1>Week of {fmtDate(week.week_commencing)}</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a className="btn small ghost" href={`/verti-block/${id}/pdf`}>
            Export PDF
          </a>
          {isManager(roles) && (
            <ConfirmButton
              action={deleteWeek.bind(null, id)}
              label="Delete week"
              className="btn small ghost"
              confirmText="Delete this week's production sheet?"
            />
          )}
        </div>
      </div>

      <WeekSheet
        week={week}
        days={(days ?? []) as VbDay[]}
        types={(types ?? []) as VbType[]}
      />
    </>
  );
}
