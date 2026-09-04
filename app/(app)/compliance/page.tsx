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
  COMPLIANCE_COLUMNS as COLUMNS,
  type ComplianceType,
  type ComplianceStatus,
} from "@/lib/compliance";

export const dynamic = "force-dynamic";

// Tighter column headings for the grid.
const SHORT_LABEL: Record<ComplianceType, string> = {
  tax: "Tax",
  cvrt_test: "CVRT",
  insurance: "Insurance",
  thirteen_week_inspection: "Inspection",
  tacho_calibration: "Tacho",
  service: "Service",
  other: "Other",
};

type Item = {
  id: string;
  asset_type: string;
  asset_id: string;
  compliance_type: string;
  due_date: string;
};

const RANK: Record<ComplianceStatus, number> = { red: 0, amber: 1, green: 2 };

// Overdue is flagged as a black/yellow badge (no red); due-soon stays amber text.
function tone(status: ComplianceStatus) {
  if (status === "amber")
    return { color: "var(--amber)", bg: "var(--amber-bg)", weight: 600 };
  return { color: "var(--green)", bg: undefined, weight: 600 };
}

function Cell({ item, addHref }: { item: Item | undefined; addHref: string }) {
  if (!item) {
    return (
      <Link
        href={addHref}
        style={{ fontSize: 12, color: "var(--muted)", opacity: 0.65 }}
      >
        + set
      </Link>
    );
  }
  const status = complianceStatus(item.due_date);
  const d = daysUntil(item.due_date);
  const t = tone(status);
  // Only show the countdown when it matters — keeps healthy rows clean.
  const showCountdown = status !== "green" || d <= 30;

  if (status === "red") {
    return (
      <Link
        href={`/compliance/${item.id}/edit`}
        style={{ textDecoration: "none", display: "block" }}
      >
        <span className="blocked">{fmtDate(item.due_date)}</span>
        {showCountdown && (
          <span style={{ display: "block", fontSize: 11, color: "var(--ink)", marginTop: 2 }}>
            {Math.abs(d)}d overdue
          </span>
        )}
      </Link>
    );
  }

  return (
    <Link
      href={`/compliance/${item.id}/edit`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <span style={{ color: t.color, fontWeight: t.weight }}>
        {fmtDate(item.due_date)}
      </span>
      {showCountdown && (
        <span
          style={{
            display: "block",
            fontSize: 11,
            color: t.color,
            opacity: 0.85,
            marginTop: 1,
          }}
        >
          {d < 0
            ? `${Math.abs(d)}d overdue`
            : d === 0
              ? "due today"
              : `in ${d}d`}
        </span>
      )}
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

  // Worst status per asset — problems float to the top of the section.
  const worst = (assetId: string): number => {
    let w = 3;
    for (const c of cols) {
      const it = byKey.get(`${assetId}:${c}`);
      if (it) w = Math.min(w, RANK[complianceStatus(it.due_date)]);
    }
    return w;
  };
  const ordered = [...assets].sort(
    (a, b) => worst(a.id) - worst(b.id) || a.name.localeCompare(b.name),
  );

  return (
    <div className="card">
      <h2>{label}</h2>
      <div style={{ overflowX: "auto" }}>
        <table className="list-table">
          <thead>
            <tr>
              <th>{ROW_LABEL[assetType]}</th>
              {cols.map((c) => (
                <th key={c}>{SHORT_LABEL[c]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.map((a) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 600 }}>{a.name}</td>
                {cols.map((c) => {
                  const it = byKey.get(`${a.id}:${c}`);
                  const bg = it ? tone(complianceStatus(it.due_date)).bg : undefined;
                  return (
                    <td
                      key={c}
                      style={{ whiteSpace: "nowrap", background: bg }}
                    >
                      <Cell
                        item={it}
                        addHref={`/compliance/new?type=${assetType}&id=${a.id}&ct=${c}`}
                      />
                    </td>
                  );
                })}
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
        Rows with a problem sit at the top. Click any date to change it, or “+ set”
        to add one. Countdowns show only when a date is within 30 days or overdue.
      </p>
    </>
  );
}
