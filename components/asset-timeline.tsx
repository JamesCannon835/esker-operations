import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";
import { INSPECTION_TYPE_LABELS } from "@/lib/inspections";

type Event = {
  at: string;
  kind: string;
  text: string;
  href: string;
  bad?: boolean;
};

export async function AssetTimeline({
  assetType,
  assetId,
}: {
  assetType: "vehicle" | "plant" | "trailer";
  assetId: string;
}) {
  const supabase = await createClient();

  const [insp, faults, services] = await Promise.all([
    supabase
      .from("inspections")
      .select("id, inspection_type, result, completed_at")
      .eq("asset_type", assetType)
      .eq("asset_id", assetId)
      .eq("voided", false)
      .order("completed_at", { ascending: false })
      .limit(20),
    supabase
      .from("faults")
      .select("id, description, status, reported_at")
      .eq("asset_type", assetType)
      .eq("asset_id", assetId)
      .eq("voided", false)
      .order("reported_at", { ascending: false })
      .limit(20),
    supabase
      .from("services")
      .select("id, service_date, notes")
      .eq("asset_type", assetType)
      .eq("asset_id", assetId)
      .order("service_date", { ascending: false })
      .limit(20),
  ]);

  const events: Event[] = [];

  for (const i of insp.data ?? []) {
    events.push({
      at: i.completed_at,
      kind: "Inspection",
      text: `${INSPECTION_TYPE_LABELS[i.inspection_type] ?? i.inspection_type} — ${
        i.result === "fail" ? "FAIL" : "pass"
      }`,
      href: `/inspections/${i.id}`,
      bad: i.result === "fail",
    });
  }
  for (const f of faults.data ?? []) {
    events.push({
      at: f.reported_at,
      kind: "Fault",
      text: `${f.description} (${f.status})`,
      href: `/faults/${f.id}`,
      bad: !["closed", "completed"].includes(f.status),
    });
  }
  for (const s of services.data ?? []) {
    events.push({
      at: s.service_date,
      kind: "Service",
      text: s.notes ?? "Service logged",
      href: `/services/${s.id}`,
    });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const shown = events.slice(0, 25);

  return (
    <div className="card">
      <h2>Inspection, fault &amp; service history</h2>
      {shown.length === 0 ? (
        <p className="hint">Nothing recorded yet.</p>
      ) : (
        <table className="list-table">
          <tbody>
            {shown.map((e, idx) => (
              <tr key={idx}>
                <td style={{ width: 150 }} className="muted">
                  {fmtDateTime(e.at)}
                </td>
                <td style={{ width: 90 }}>
                  <span className="badge">{e.kind}</span>
                </td>
                <td>
                  <Link
                    href={e.href}
                    className={e.bad ? "blocked" : undefined}
                  >
                    {e.text}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
