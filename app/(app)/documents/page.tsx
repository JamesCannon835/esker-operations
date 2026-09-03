import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";
import { resolveAssetLabels } from "@/lib/asset-labels";
import { fmtDate } from "@/lib/format";
import { complianceStatus } from "@/lib/compliance";
import {
  DOCUMENT_CATEGORY_LABELS,
  type DocumentCategory,
} from "@/lib/documents";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const { roles } = await requireUser();
  const canUpload = isManager(roles) || hasRole(roles, "mechanic");

  const supabase = await createClient();
  const { data: docs, error } = await supabase
    .from("documents")
    .select(
      "id, asset_type, asset_id, category, title, file_url, uploaded_at, expiry_date",
    )
    .eq("voided", false)
    .order("uploaded_at", { ascending: false })
    .limit(300);

  const rows = docs ?? [];
  const labels = await resolveAssetLabels(rows);

  return (
    <>
      <div className="page-head">
        <h1>Documents</h1>
        {canUpload && (
          <Link className="btn small" href="/documents/new">
            + Upload
          </Link>
        )}
      </div>

      {error && <div className="error">{error.message}</div>}

      <div className="card">
        {rows.length === 0 ? (
          <p className="empty">No documents uploaded yet.</p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Asset</th>
                <th>Category</th>
                <th>Uploaded</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const name =
                  d.title ?? String(d.file_url).split("/").pop() ?? d.file_url;
                const exp =
                  d.expiry_date && complianceStatus(d.expiry_date);
                return (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/documents/${d.id}/download`}>{name}</Link>
                    </td>
                    <td className="muted">
                      {labels.get(`${d.asset_type}:${d.asset_id}`) ?? "—"}
                    </td>
                    <td className="muted">
                      {DOCUMENT_CATEGORY_LABELS[
                        d.category as DocumentCategory
                      ] ?? d.category}
                    </td>
                    <td className="muted">{fmtDate(d.uploaded_at)}</td>
                    <td>
                      {d.expiry_date ? (
                        <span
                          className={
                            exp === "red"
                              ? "blocked"
                              : exp === "green"
                                ? ""
                                : ""
                          }
                          style={
                            exp === "amber"
                              ? { color: "var(--amber)", fontWeight: 600 }
                              : undefined
                          }
                        >
                          {fmtDate(d.expiry_date)}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
