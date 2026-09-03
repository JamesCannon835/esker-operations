import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveAssetLabels, assetHref } from "@/lib/asset-labels";

export const dynamic = "force-dynamic";

const PERIODS: Record<string, { label: string; days: number | null }> = {
  all: { label: "All time", days: null },
  y1: { label: "Last 12 months", days: 365 },
  d90: { label: "Last 90 days", days: 90 },
};

function euro(n: number) {
  return `€${n.toFixed(2)}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: p } = await searchParams;
  const period = PERIODS[p ?? "y1"] ? (p ?? "y1") : "y1";
  const since = PERIODS[period].days
    ? new Date(Date.now() - PERIODS[period].days! * 86_400_000).toISOString()
    : null;
  const sinceDate = since ? since.slice(0, 10) : null;

  const supabase = await createClient();

  let faultsQ = supabase
    .from("faults")
    .select("id, asset_type, asset_id, status, reported_at")
    .eq("voided", false);
  if (since) faultsQ = faultsQ.gte("reported_at", since);

  let servicesQ = supabase
    .from("services")
    .select("asset_type, asset_id, cost, service_date");
  if (sinceDate) servicesQ = servicesQ.gte("service_date", sinceDate);

  const [{ data: faults }, { data: parts }, { data: services }] =
    await Promise.all([
      faultsQ,
      supabase.from("parts_used").select("fault_id, total_cost"),
      servicesQ,
    ]);

  const faultRows = faults ?? [];
  const faultAsset = new Map<string, string>();
  const agg = new Map<
    string,
    {
      faultsOpen: number;
      faultsTotal: number;
      partsCost: number;
      serviceCost: number;
    }
  >();

  const get = (k: string) => {
    if (!agg.has(k))
      agg.set(k, {
        faultsOpen: 0,
        faultsTotal: 0,
        partsCost: 0,
        serviceCost: 0,
      });
    return agg.get(k)!;
  };

  for (const f of faultRows) {
    const k = `${f.asset_type}:${f.asset_id}`;
    faultAsset.set(f.id, k);
    const a = get(k);
    a.faultsTotal++;
    if (!["closed", "completed"].includes(f.status)) a.faultsOpen++;
  }
  for (const pt of parts ?? []) {
    const k = faultAsset.get(pt.fault_id ?? "");
    if (k) get(k).partsCost += Number(pt.total_cost ?? 0);
  }
  for (const s of services ?? []) {
    get(`${s.asset_type}:${s.asset_id}`).serviceCost += Number(s.cost ?? 0);
  }

  const refs = [...agg.keys()].map((k) => {
    const [asset_type, asset_id] = k.split(":");
    return { asset_type, asset_id };
  });
  const labels = await resolveAssetLabels(refs);

  const rows = [...agg.entries()]
    .map(([k, v]) => ({
      key: k,
      label: labels.get(k) ?? k,
      href: assetHref(k.split(":")[0], k.split(":")[1]),
      ...v,
      total: v.partsCost + v.serviceCost,
    }))
    .sort((a, b) => b.total - a.total || b.faultsTotal - a.faultsTotal);

  const totals = rows.reduce(
    (acc, r) => ({
      parts: acc.parts + r.partsCost,
      service: acc.service + r.serviceCost,
    }),
    { parts: 0, service: 0 },
  );

  return (
    <>
      <div className="page-head">
        <h1>Reports</h1>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.entries(PERIODS).map(([k, v]) => (
            <Link
              key={k}
              href={`/reports?period=${k}`}
              className={`btn small ${k === period ? "" : "ghost"}`}
            >
              {v.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid" style={{ marginBottom: 16 }}>
        <div className="tile">
          <div className="label">Parts spend</div>
          <div className="value">{euro(totals.parts)}</div>
        </div>
        <div className="tile">
          <div className="label">Service spend</div>
          <div className="value">{euro(totals.service)}</div>
        </div>
        <div className="tile">
          <div className="label">Total</div>
          <div className="value">{euro(totals.parts + totals.service)}</div>
        </div>
      </div>

      <div className="card">
        <h2>By asset — {PERIODS[period].label}</h2>
        {rows.length === 0 ? (
          <p className="empty">No activity in this period.</p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Faults (open)</th>
                <th>Parts</th>
                <th>Services</th>
                <th>Total cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>
                    {r.href ? <Link href={r.href}>{r.label}</Link> : r.label}
                  </td>
                  <td>
                    {r.faultsTotal}{" "}
                    {r.faultsOpen > 0 && (
                      <span className="blocked">({r.faultsOpen})</span>
                    )}
                  </td>
                  <td className="muted">{euro(r.partsCost)}</td>
                  <td className="muted">{euro(r.serviceCost)}</td>
                  <td>
                    <strong>{euro(r.total)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="field-hint" style={{ marginTop: 8 }}>
          Parts cost comes from fault records; service cost from the service log.
          Labour time is tracked but not costed (no labour rate set).
        </p>
      </div>
    </>
  );
}
