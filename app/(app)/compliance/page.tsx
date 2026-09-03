import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";
import { vehicleName } from "@/lib/asset-name";
import { fmtDate } from "@/lib/format";
import {
  complianceStatus,
  daysUntil,
  COMPLIANCE_TYPE_LABELS,
  COMPLIANCE_COLUMNS as COLUMNS,
  type ComplianceType,
} from "@/lib/compliance";

export const dynamic = "force-dynamic";

type Item = {
  id: string;
  asset_type: string;
  asset_id: string;
  compliance_type: string;
  due_date: string;
};

function Cell({
  item,
  addHref,
}: {
  item: Item | undefined;
  addHref: string;
}) {
  if (!item) {
    return (
      <Link className="muted" href={addHref}>
        + set
      </Link>
    );
  }
  const status = complianceStatus(item.due_date);
  const d = daysUntil(item.due_date);
  const cls =
    status === "red" ? "blocked" : status === "green" ? "ok" : undefined;
  return (
    <Link
      href={`/compliance/${item.id}/edit`}
      style={{ textDecoration: "none" }}
    >
      <span
        className={cls}
        style={
          status === "amber"
            ? { color: "var(--amber)", fontWeight: 600 }
            : undefined
        }
      >
        {fmtDate(item.due_date)}
      </span>
      <br />
      <span className="muted" style={{ fontSize: 12 }}>
        {d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "today" : `in ${d}d`}
      </span>
    </Link>
  );
}

const ROW_LABEL: Record<"vehicle" | "plant" | "trailer", string> = {
  vehicle: "Vehicle",
  plant: "Plant item",
  trailer: "Trailer",
};

function Section({
  assetType,
  label,
  assets,
  items,
}: {
  assetType: "vehicle" | "plant" | "trailer";
  label: string;
  assets: { id: string; name: string }[];
  items: Item[];
}) {
  if (assets.length === 0) return null;
  const cols = COLUMNS[assetType];
  const byKey = new Map<string, Item>();
  for (const it of items) {
    if (it.asset_type === assetType) {
      byKey.set(`${it.asset_id}:${it.compliance_type}`, it);
    }
  }

  return (
    <div className="card">
      <h2>{label}</h2>
      <div style={{ overflowX: "auto" }}>
        <table className="list-table">
          <thead>
            <tr>
              <th>{ROW_LABEL[assetType]}</th>
              {cols.map((c) => (
                <th key={c}>{COMPLIANCE_TYPE_LABELS[c]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                {cols.map((c) => (
                  <td key={c} style={{ whiteSpace: "nowrap" }}>
                    <Cell
                      item={byKey.get(`${a.id}:${c}`)}
                      addHref={`/compliance/new?type=${assetType}&id=${a.id}&ct=${c}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function CompliancePage() {
  const { roles } = await requireUser();
  if (!isManager(roles) && !hasRole(roles, "mechanic")) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: items }, { data: vehicles }, { data: plant }, { data: trailers }] =
    await Promise.all([
      supabase
        .from("compliance_items")
        .select("id, asset_type, asset_id, compliance_type, due_date")
        .eq("voided", false),
      supabase
        .from("vehicles")
        .select("id, fleet_number, registration")
        .eq("voided", false)
        .order("registration"),
      supabase
        .from("plant")
        .select("id, asset_number, plant_type")
        .eq("voided", false)
        .order("asset_number"),
      supabase
        .from("trailers")
        .select("id, registration")
        .eq("voided", false)
        .order("registration"),
    ]);

  const rows = (items ?? []) as Item[];
  const counts = { red: 0, amber: 0, green: 0 };
  for (const r of rows) counts[complianceStatus(r.due_date)]++;

  return (
    <>
      <div className="page-head">
        <h1>Compliance</h1>
        <Link className="btn small" href="/compliance/new">
          + Add date
        </Link>
      </div>

      <div className="grid" style={{ marginBottom: 16 }}>
        <div className="tile">
          <div className="label">Overdue</div>
          <div className="value" style={{ color: "var(--danger)" }}>
            {counts.red}
          </div>
        </div>
        <div className="tile">
          <div className="label">Due soon (14d)</div>
          <div className="value" style={{ color: "var(--amber)" }}>
            {counts.amber}
          </div>
        </div>
        <div className="tile">
          <div className="label">OK</div>
          <div className="value ok">{counts.green}</div>
        </div>
      </div>

      <Section
        assetType="vehicle"
        label="Vehicles"
        assets={(vehicles ?? []).map((v) => ({
          id: v.id,
          name: vehicleName(v.fleet_number, v.registration),
        }))}
        items={rows}
      />
      <Section
        assetType="plant"
        label="Plant"
        assets={(plant ?? []).map((p) => ({
          id: p.id,
          name: `${p.asset_number}${p.plant_type ? ` · ${p.plant_type}` : ""}`,
        }))}
        items={rows}
      />
      <Section
        assetType="trailer"
        label="Trailers"
        assets={(trailers ?? []).map((t) => ({
          id: t.id,
          name: t.registration,
        }))}
        items={rows}
      />

      <p className="field-hint">
        Click a date to change it, or “+ set” to add one. When a job&apos;s done,
        update the date here.
      </p>
    </>
  );
}
