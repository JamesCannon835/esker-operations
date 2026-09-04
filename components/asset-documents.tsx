import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { complianceStatus } from "@/lib/compliance";
import {
  DOCUMENT_CATEGORY_LABELS,
  type DocumentCategory,
} from "@/lib/documents";

/** Photos / scanned documents stored against one asset. */
export async function AssetDocuments({
  assetType,
  assetId,
}: {
  assetType: "vehicle" | "plant" | "trailer";
  assetId: string;
}) {
  const supabase = await createClient();
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, category, file_url, expiry_date, uploaded_at")
    .eq("asset_type", assetType)
    .eq("asset_id", assetId)
    .eq("voided", false)
    .order("uploaded_at", { ascending: false });

  const rows = docs ?? [];
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
        <h2 style={{ margin: 0 }}>Documents &amp; photos</h2>
        <Link className="btn small" href={`/documents/new?${q}`}>
          + Upload
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="hint" style={{ marginBottom: 0 }}>
          Nothing uploaded yet — scans, photos, certs, invoices all go here.
        </p>
      ) : (
        <table className="list-table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Uploaded</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const name =
                d.title ?? String(d.file_url).split("/").pop() ?? "file";
              const exp = d.expiry_date && complianceStatus(d.expiry_date);
              return (
                <tr key={d.id}>
                  <td>
                    <Link href={`/documents/${d.id}/download`}>{name}</Link>
                  </td>
                  <td className="muted">
                    {DOCUMENT_CATEGORY_LABELS[d.category as DocumentCategory] ??
                      d.category ??
                      "—"}
                  </td>
                  <td className="muted">{fmtDate(d.uploaded_at)}</td>
                  <td
                    style={
                      exp === "amber"
                        ? { color: "var(--amber)", fontWeight: 600 }
                        : undefined
                    }
                  >
                    {exp === "red" ? (
                      <span className="blocked">{fmtDate(d.expiry_date)}</span>
                    ) : d.expiry_date ? (
                      fmtDate(d.expiry_date)
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
