import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TrailersPage({
  searchParams,
}: {
  searchParams: Promise<{ voided?: string }>;
}) {
  const { voided } = await searchParams;
  const showVoided = voided === "1";

  const supabase = await createClient();
  let query = supabase
    .from("trailers")
    .select(
      "id, registration, trailer_type, make, model, voided, vehicle:assigned_vehicle_id (fleet_number)",
    )
    .order("registration");
  if (!showVoided) query = query.eq("voided", false);

  const { data: trailers, error } = await query;

  return (
    <>
      <div className="page-head">
        <h1>Trailers</h1>
        <Link className="btn small" href="/trailers/new">
          + Add trailer
        </Link>
      </div>

      {error && <div className="error">{error.message}</div>}

      <div className="card">
        {!trailers || trailers.length === 0 ? (
          <p className="empty">
            No trailers yet.{" "}
            <Link href="/trailers/new">Add the first one</Link>.
          </p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Registration</th>
                <th>Type</th>
                <th>Make / model</th>
                <th>On vehicle</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {trailers.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/trailers/${t.id}`}>{t.registration}</Link>
                    {t.voided && <span className="muted"> · voided</span>}
                  </td>
                  <td className="muted">{t.trailer_type ?? "—"}</td>
                  <td className="muted">
                    {[t.make, t.model].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="muted">
                    {(t.vehicle as { fleet_number?: string } | null)
                      ?.fleet_number ?? "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link
                      className="btn ghost small"
                      href={`/trailers/${t.id}/edit`}
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

      <p className="field-hint">
        {showVoided ? (
          <Link href="/trailers">Hide voided records</Link>
        ) : (
          <Link href="/trailers?voided=1">Show voided records</Link>
        )}
      </p>
    </>
  );
}
