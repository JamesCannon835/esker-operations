import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import {
  complianceStatus,
  daysUntil,
  COMPLIANCE_TYPE_LABELS,
  COMPLIANCE_STATUS_LABELS,
  type ComplianceType,
} from "@/lib/compliance";
/** Compliance dates for one asset, for its detail page. */
export async function AssetCompliancePanel({
  assetType,
  assetId,
}: {
  assetType: "vehicle" | "plant" | "trailer";
  assetId: string;
}) {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("compliance_items")
    .select("id, compliance_type, due_date, last_completed_date")
    .eq("asset_type", assetType)
    .eq("asset_id", assetId)
    .eq("voided", false);

  const rows = (items ?? [])
    .map((i) => ({ ...i, status: complianceStatus(i.due_date), days: daysUntil(i.due_date) }))
    .sort((a, b) => a.days - b.days);

  const q = `type=${assetType}&id=${assetId}`;

  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 style={{ margin: 0 }}>Compliance</h2>
        <Link className="btn small ghost" href={`/compliance/new?${q}`}>
          Add date
        </Link>
      </div>

      <div style={{ marginTop: 12 }} />
      {rows.length === 0 ? (
        <p className="hint">None recorded.</p>
      ) : (
        <table className="list-table">
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {COMPLIANCE_TYPE_LABELS[
                    r.compliance_type as ComplianceType
                  ] ?? r.compliance_type}
                </td>
                <td>{fmtDate(r.due_date)}</td>
                <td>
                  <span
                    className={
                      r.status === "red"
                        ? "blocked"
                        : r.status === "green"
                          ? "ok"
                          : ""
                    }
                    style={
                      r.status === "amber"
                        ? { color: "var(--amber)", fontWeight: 600 }
                        : undefined
                    }
                  >
                    {COMPLIANCE_STATUS_LABELS[r.status]}
                  </span>
                </td>
                <td>
                  <Link
                    className="btn ghost small"
                    href={`/compliance/${r.id}/edit`}
                  >
                    Edit
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
