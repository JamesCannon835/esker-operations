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
import {
  DOCUMENT_CATEGORY_LABELS,
  type DocumentCategory,
} from "@/lib/documents";

/** Compliance dates + documents for one asset, for its detail page. */
export async function AssetCompliancePanel({
  assetType,
  assetId,
}: {
  assetType: "vehicle" | "plant" | "trailer";
  assetId: string;
}) {
  const supabase = await createClient();
  const [{ data: items }, { data: docs }] = await Promise.all([
    supabase
      .from("compliance_items")
      .select("id, compliance_type, due_date, last_completed_date")
      .eq("asset_type", assetType)
      .eq("asset_id", assetId)
      .eq("voided", false),
    supabase
      .from("documents")
      .select("id, category, title, file_url, expiry_date")
      .eq("asset_type", assetType)
      .eq("asset_id", assetId)
      .eq("voided", false)
      .order("uploaded_at", { ascending: false }),
  ]);

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
        <h2 style={{ margin: 0 }}>Compliance &amp; documents</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="btn small ghost" href={`/compliance/new?${q}`}>
            Add date
          </Link>
          <Link className="btn small ghost" href={`/documents/new?${q}`}>
            Upload doc
          </Link>
        </div>
      </div>

      <h3 style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
        COMPLIANCE DATES
      </h3>
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

      <h3 style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
        DOCUMENTS
      </h3>
      {!docs || docs.length === 0 ? (
        <p className="hint">None uploaded.</p>
      ) : (
        <table className="list-table">
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>
                  <Link href={`/documents/${d.id}/download`}>
                    {d.title ?? String(d.file_url).split("/").pop()}
                  </Link>
                </td>
                <td className="muted">
                  {DOCUMENT_CATEGORY_LABELS[d.category as DocumentCategory] ??
                    d.category}
                </td>
                <td className="muted">
                  {d.expiry_date ? `expires ${fmtDate(d.expiry_date)}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
