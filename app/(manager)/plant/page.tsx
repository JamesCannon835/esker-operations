import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS, type AssetStatus } from "@/lib/assets";

export const dynamic = "force-dynamic";

export default async function PlantPage({
  searchParams,
}: {
  searchParams: Promise<{ voided?: string }>;
}) {
  const { voided } = await searchParams;
  const showVoided = voided === "1";

  const supabase = await createClient();
  let query = supabase
    .from("plant")
    .select("id, asset_number, plant_type, make, model, status, current_hours, voided")
    .order("asset_number");
  if (!showVoided) query = query.eq("voided", false);

  const { data: plant, error } = await query;

  return (
    <>
      <div className="page-head">
        <h1>Plant</h1>
        <Link className="btn small" href="/plant/new">
          + Add plant
        </Link>
      </div>

      {error && <div className="error">{error.message}</div>}

      <div className="card">
        {!plant || plant.length === 0 ? (
          <p className="empty">
            No plant yet. <Link href="/plant/new">Add the first item</Link>.
          </p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Asset no.</th>
                <th>Type</th>
                <th>Make / model</th>
                <th>Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {plant.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/plant/${p.id}`}>{p.asset_number}</Link>
                    {p.voided && <span className="muted"> · voided</span>}
                  </td>
                  <td className="muted">{p.plant_type ?? "—"}</td>
                  <td className="muted">
                    {[p.make, p.model].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="muted">
                    {p.current_hours != null
                      ? `${Number(p.current_hours).toLocaleString()} h`
                      : "—"}
                  </td>
                  <td>
                    <span className={`status-pill ${p.status}`}>
                      {STATUS_LABELS[p.status as AssetStatus] ?? p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="field-hint">
        {showVoided ? (
          <Link href="/plant">Hide voided records</Link>
        ) : (
          <Link href="/plant?voided=1">Show voided records</Link>
        )}
      </p>
    </>
  );
}
