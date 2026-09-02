import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ASSET_TYPE_LABELS, type AssetTypeT } from "@/lib/inspections";

export const dynamic = "force-dynamic";

export default async function ChecklistsPage() {
  const supabase = await createClient();
  const { data: templates, error } = await supabase
    .from("inspection_templates")
    .select("id, name, asset_type, category, inspection_template_items(count)")
    .order("asset_type")
    .order("name");

  return (
    <>
      <div className="page-head">
        <h1>Checklists</h1>
        <Link className="btn small" href="/checklists/new">
          + New checklist
        </Link>
      </div>

      <p className="field-hint" style={{ marginTop: -8, marginBottom: 16 }}>
        Templates used by the daily check. The driver / operator flow picks the
        template that matches the asset type.
      </p>

      {error && <div className="error">{error.message}</div>}

      <div className="card">
        {!templates || templates.length === 0 ? (
          <p className="empty">
            No checklists yet.{" "}
            <Link href="/checklists/new">Create the first one</Link>.
          </p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Asset type</th>
                <th>Items</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => {
                const count =
                  (t.inspection_template_items as { count: number }[])?.[0]
                    ?.count ?? 0;
                return (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/checklists/${t.id}`}>{t.name}</Link>
                      {t.category && (
                        <span className="muted"> · {t.category}</span>
                      )}
                    </td>
                    <td className="muted">
                      {ASSET_TYPE_LABELS[t.asset_type as AssetTypeT] ??
                        t.asset_type}
                    </td>
                    <td className="muted">{count}</td>
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
