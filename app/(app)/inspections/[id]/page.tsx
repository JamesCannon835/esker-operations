import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ITEM_RESULT_LABELS, type ItemResult } from "@/lib/inspections";
import { resolveAssetLabels, assetHref } from "@/lib/asset-labels";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: inspection } = await supabase
    .from("inspections")
    .select(
      "id, inspection_type, asset_type, asset_id, result, completed_at, completed_by, mileage_or_hours, signature_confirmed, template_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (!inspection) notFound();

  const [{ data: results }, { data: template }, { data: person }, labels] =
    await Promise.all([
      supabase
        .from("inspection_item_results")
        .select("id, template_item_id, result, comment")
        .eq("inspection_id", id),
      inspection.template_id
        ? supabase
            .from("inspection_templates")
            .select("name")
            .eq("id", inspection.template_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      inspection.completed_by
        ? supabase
            .from("users")
            .select("full_name")
            .eq("id", inspection.completed_by)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      resolveAssetLabels([inspection]),
    ]);

  const itemIds = (results ?? [])
    .map((r) => r.template_item_id)
    .filter(Boolean) as string[];
  const nameMap = new Map<string, string>();
  if (itemIds.length) {
    const { data: itemRows } = await supabase
      .from("inspection_template_items")
      .select("id, item_name, sort_order")
      .in("id", itemIds);
    for (const it of itemRows ?? []) nameMap.set(it.id, it.item_name);
  }

  const ordered = (results ?? [])
    .map((r) => ({
      ...r,
      name: nameMap.get(r.template_item_id ?? "") ?? "(removed item)",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const { data: faults } = await supabase
    .from("faults")
    .select("id, description, severity, status")
    .eq("source_inspection_id", id);

  const assetLabel =
    labels.get(`${inspection.asset_type}:${inspection.asset_id}`) ?? "—";
  const href = assetHref(inspection.asset_type, inspection.asset_id);

  return (
    <>
      <Link className="link-back" href="/inspections">
        ← Inspections
      </Link>
      <div className="page-head">
        <h1>Inspection — {assetLabel}</h1>
      </div>

      <div
        className={`result-banner ${inspection.result === "fail" ? "fail" : "pass"}`}
      >
        {inspection.result === "fail"
          ? "Result: FAIL — one or more items failed"
          : "Result: PASS"}
      </div>

      <div className="card">
        <div className="detail-grid">
          <div>
            <div className="label">Completed</div>
            <div className="value">
              {fmtDateTime(inspection.completed_at)}
            </div>
          </div>
          <div>
            <div className="label">By</div>
            <div className="value">
              {(person as { full_name?: string } | null)?.full_name ?? "—"}
            </div>
          </div>
          <div>
            <div className="label">Checklist</div>
            <div className="value">
              {(template as { name?: string } | null)?.name ?? "—"}
            </div>
          </div>
          <div>
            <div className="label">Mileage / hours</div>
            <div className="value">
              {inspection.mileage_or_hours != null
                ? Number(inspection.mileage_or_hours).toLocaleString()
                : "—"}
            </div>
          </div>
          <div>
            <div className="label">Asset</div>
            <div className="value">
              {href ? <Link href={href}>{assetLabel}</Link> : assetLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Items</h2>
        <table className="list-table">
          <tbody>
            {ordered.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td style={{ width: 70 }}>
                  <span
                    className={
                      r.result === "fail"
                        ? "blocked"
                        : r.result === "na"
                          ? "muted"
                          : "ok"
                    }
                  >
                    {ITEM_RESULT_LABELS[r.result as ItemResult] ?? r.result}
                  </span>
                </td>
                <td className="muted">{r.comment ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {faults && faults.length > 0 && (
        <div className="card">
          <h2>Faults raised ({faults.length})</h2>
          <table className="list-table">
            <tbody>
              {faults.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link href={`/faults/${f.id}`}>{f.description}</Link>
                  </td>
                  <td className="muted">{f.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
