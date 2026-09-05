import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager, canProduction } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import {
  LOAD_STATUS_LABELS,
  type VbLoad,
  type VbLoadLine,
  type VbType,
} from "@/lib/verti-block";
import { ConfirmButton } from "@/components/confirm-button";
import { LoadBuilder } from "../load-builder";
import { setLoadStatus, deleteLoad } from "../actions";

export const dynamic = "force-dynamic";

const NEXT_STATUS: Record<string, { to: string; label: string }> = {
  building: { to: "loaded", label: "Mark loaded" },
  loaded: { to: "dispatched", label: "Mark dispatched" },
};

export default async function LoadPage({
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

  const [{ data: load }, { data: lines }, { data: types }] = await Promise.all([
    supabase
      .from("verti_loads")
      .select(
        "id, reference, customer, load_date, truck_reg, max_payload_kg, status, notes",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("verti_load_lines")
      .select("id, load_id, block_type_id, quantity, weight_kg, unit_price")
      .eq("load_id", id),
    supabase
      .from("verti_block_types")
      .select("id, name, sort_order, active, weight_kg, unit_price")
      .eq("active", true)
      .order("sort_order")
      .order("name"),
  ]);

  if (!load) notFound();
  const next = NEXT_STATUS[load.status];

  return (
    <>
      <Link className="link-back" href="/verti-block/loads">
        ← Loads
      </Link>
      <div className="page-head">
        <h1>{load.reference || load.customer || "Load"}</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn small ghost" href={`/verti-block/loads/${id}/edit`}>
            Edit details
          </Link>
          {next && (
            <ConfirmButton
              action={setLoadStatus.bind(null, id, next.to)}
              label={next.label}
              className="btn small"
              confirmText={`${next.label}?`}
            />
          )}
          <ConfirmButton
            action={deleteLoad.bind(null, id)}
            label="Delete"
            className="btn small ghost"
            confirmText="Delete this load?"
          />
        </div>
      </div>

      <p className="hint">
        {[
          load.customer,
          fmtDate(load.load_date),
          load.truck_reg,
          `Status: ${LOAD_STATUS_LABELS[load.status] ?? load.status}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        {load.notes ? ` — ${load.notes}` : ""}
      </p>

      <LoadBuilder
        load={load as VbLoad}
        lines={(lines ?? []) as VbLoadLine[]}
        types={(types ?? []) as VbType[]}
      />
    </>
  );
}
