import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";
import {
  FAULT_STATUS_LABELS,
  FAULT_SEVERITY_LABELS,
  type FaultSeverity,
} from "@/lib/inspections";
import { resolveAssetLabels } from "@/lib/asset-labels";
import { fmtDate } from "@/lib/format";
import { ConfirmButton } from "@/components/confirm-button";
import { closeFault } from "./[id]/actions";

export const dynamic = "force-dynamic";

const OPEN = ["reported", "accepted", "in_progress", "awaiting_parts"];

export default async function FaultsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { user, roles } = await requireUser();
  // Managers and mechanics see the whole workshop queue.
  // Drivers / operators only see faults they raised.
  const seeAll = isManager(roles) || hasRole(roles, "mechanic");

  const { show } = await searchParams;
  const showClosed = show === "all";

  const supabase = await createClient();
  let query = supabase
    .from("faults")
    .select(
      "id, asset_type, asset_id, description, severity, status, reported_at, safe_to_operate",
    )
    .eq("voided", false)
    .order("reported_at", { ascending: false })
    .limit(200);
  if (!seeAll) query = query.eq("reported_by", user.id);
  if (!showClosed) query = query.in("status", OPEN);

  const { data: faults, error } = await query;
  const rows = faults ?? [];
  const labels = await resolveAssetLabels(rows);

  return (
    <>
      <div className="page-head">
        <h1>{seeAll ? "Faults" : "My faults"}</h1>
        <Link className="btn small" href="/faults/new">
          + Report fault
        </Link>
      </div>

      {error && <div className="error">{error.message}</div>}

      <div className="card">
        {rows.length === 0 ? (
          <p className="empty">
            {showClosed ? "No faults recorded." : "No open faults."}
          </p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Reported</th>
                <th>Asset</th>
                <th>Fault</th>
                <th>Severity</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link href={`/faults/${f.id}`}>
                      {fmtDate(f.reported_at)}
                    </Link>
                  </td>
                  <td className="muted">
                    {labels.get(`${f.asset_type}:${f.asset_id}`) ?? "—"}
                  </td>
                  <td>
                    <Link href={`/faults/${f.id}`}>{f.description}</Link>
                    {!f.safe_to_operate && (
                      <span className="blocked"> · not safe to operate</span>
                    )}
                  </td>
                  <td>
                    <span className={`severity-pill ${f.severity}`}>
                      {FAULT_SEVERITY_LABELS[f.severity as FaultSeverity] ??
                        f.severity}
                    </span>
                  </td>
                  <td className="muted">
                    {FAULT_STATUS_LABELS[f.status] ?? f.status}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {seeAll && f.status !== "closed" && (
                      <ConfirmButton
                        action={closeFault.bind(null, f.id)}
                        label="Mark fixed"
                        className="btn small"
                        confirmText="Mark this fault as fixed? It moves out of the open list."
                      />
                    )}{" "}
                    <Link className="btn ghost small" href={`/faults/${f.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="field-hint">
        {showClosed ? (
          <Link href="/faults">Show open only</Link>
        ) : (
          <Link href="/faults?show=all">Show all (incl. closed)</Link>
        )}
      </p>
    </>
  );
}
