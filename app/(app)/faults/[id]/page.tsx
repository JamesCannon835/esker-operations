import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  FAULT_STATUS_LABELS,
  FAULT_SEVERITY_LABELS,
  type FaultSeverity,
} from "@/lib/inspections";
import { resolveAssetLabels, assetHref } from "@/lib/asset-labels";

export const dynamic = "force-dynamic";

export default async function FaultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: fault } = await supabase
    .from("faults")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!fault) notFound();

  const [{ data: reporter }, { data: mechanic }, labels] = await Promise.all([
    fault.reported_by
      ? supabase
          .from("users")
          .select("full_name")
          .eq("id", fault.reported_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    fault.assigned_mechanic_id
      ? supabase
          .from("users")
          .select("full_name")
          .eq("id", fault.assigned_mechanic_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    resolveAssetLabels([fault]),
  ]);

  const assetLabel = labels.get(`${fault.asset_type}:${fault.asset_id}`) ?? "—";
  const href = assetHref(fault.asset_type, fault.asset_id);

  return (
    <>
      <Link className="link-back" href="/faults">
        ← Faults
      </Link>
      <div className="page-head">
        <h1>Fault — {assetLabel}</h1>
        <span className={`severity-pill ${fault.severity}`}>
          {FAULT_SEVERITY_LABELS[fault.severity as FaultSeverity] ??
            fault.severity}
        </span>
      </div>

      {!fault.safe_to_operate && (
        <div className="voided-banner">Reported as NOT safe to operate.</div>
      )}

      <div className="card">
        <h2>{fault.description}</h2>
        <div className="detail-grid" style={{ marginTop: 12 }}>
          <div>
            <div className="label">Status</div>
            <div className="value">
              {FAULT_STATUS_LABELS[fault.status] ?? fault.status}
            </div>
          </div>
          <div>
            <div className="label">Reported</div>
            <div className="value">
              {new Date(fault.reported_at).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="label">Reported by</div>
            <div className="value">
              {(reporter as { full_name?: string } | null)?.full_name ?? "—"}
            </div>
          </div>
          <div>
            <div className="label">Category</div>
            <div className="value">{fault.category ?? "—"}</div>
          </div>
          <div>
            <div className="label">Location</div>
            <div className="value">{fault.location ?? "—"}</div>
          </div>
          <div>
            <div className="label">Assigned mechanic</div>
            <div className="value">
              {(mechanic as { full_name?: string } | null)?.full_name ??
                "Unassigned"}
            </div>
          </div>
          <div>
            <div className="label">Asset</div>
            <div className="value">
              {href ? <Link href={href}>{assetLabel}</Link> : assetLabel}
            </div>
          </div>
          {fault.source_inspection_id && (
            <div>
              <div className="label">From inspection</div>
              <div className="value">
                <Link href={`/inspections/${fault.source_inspection_id}`}>
                  View inspection
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {fault.diagnosis && (
        <div className="card">
          <h2>Diagnosis</h2>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{fault.diagnosis}</p>
        </div>
      )}

      <div className="card">
        <p className="hint">
          The mechanic workflow — accepting the job, recording diagnosis, parts,
          labour and closing it — comes in Phase 4.
        </p>
      </div>
    </>
  );
}
