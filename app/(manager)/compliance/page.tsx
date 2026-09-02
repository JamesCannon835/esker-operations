import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { resolveAssetLabels, assetHref } from "@/lib/asset-labels";
import { fmtDate } from "@/lib/format";
import {
  complianceStatus,
  daysUntil,
  STATUS_ORDER,
  COMPLIANCE_TYPE_LABELS,
  COMPLIANCE_STATUS_LABELS,
  type ComplianceType,
  type ComplianceStatus,
} from "@/lib/compliance";

export const dynamic = "force-dynamic";

function dueText(days: number) {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "due today";
  return `in ${days}d`;
}

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: filter } = await searchParams;

  const supabase = await createClient();
  const { data: items, error } = await supabase
    .from("compliance_items")
    .select(
      "id, asset_type, asset_id, compliance_type, due_date, last_completed_date, notes",
    )
    .eq("voided", false);

  const rows = (items ?? []).map((i) => ({
    ...i,
    status: complianceStatus(i.due_date),
    days: daysUntil(i.due_date),
  }));

  rows.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.days - b.days,
  );

  const counts: Record<ComplianceStatus, number> = {
    red: rows.filter((r) => r.status === "red").length,
    amber: rows.filter((r) => r.status === "amber").length,
    green: rows.filter((r) => r.status === "green").length,
  };

  const shown =
    filter === "red" || filter === "amber" || filter === "green"
      ? rows.filter((r) => r.status === filter)
      : rows;

  const labels = await resolveAssetLabels(rows);

  return (
    <>
      <div className="page-head">
        <h1>Compliance</h1>
        <Link className="btn small" href="/compliance/new">
          + Add item
        </Link>
      </div>

      {error && <div className="error">{error.message}</div>}

      <div className="grid" style={{ marginBottom: 16 }}>
        <Link className="tile" href="/compliance?status=red">
          <div className="label">Overdue</div>
          <div className="value" style={{ color: "var(--danger)" }}>
            {counts.red}
          </div>
        </Link>
        <Link className="tile" href="/compliance?status=amber">
          <div className="label">Due soon (14d)</div>
          <div className="value" style={{ color: "var(--amber)" }}>
            {counts.amber}
          </div>
        </Link>
        <Link className="tile" href="/compliance?status=green">
          <div className="label">OK</div>
          <div className="value ok">{counts.green}</div>
        </Link>
      </div>

      <div className="card">
        {filter && (
          <p className="field-hint" style={{ marginBottom: 10 }}>
            Filtered to {COMPLIANCE_STATUS_LABELS[filter as ComplianceStatus]}.{" "}
            <Link href="/compliance">Show all</Link>
          </p>
        )}
        {shown.length === 0 ? (
          <p className="empty">
            {rows.length === 0 ? (
              <>
                No compliance items yet.{" "}
                <Link href="/compliance/new">Add the first one</Link>.
              </>
            ) : (
              "Nothing in this category."
            )}
          </p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Type</th>
                <th>Due</th>
                <th>Status</th>
                <th>Last done</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const href = assetHref(r.asset_type, r.asset_id);
                return (
                  <tr key={r.id} id={`item-${r.id}`}>
                    <td>
                      {href ? (
                        <Link href={href}>
                          {labels.get(`${r.asset_type}:${r.asset_id}`) ?? "—"}
                        </Link>
                      ) : (
                        (labels.get(`${r.asset_type}:${r.asset_id}`) ?? "—")
                      )}
                    </td>
                    <td>
                      {COMPLIANCE_TYPE_LABELS[
                        r.compliance_type as ComplianceType
                      ] ?? r.compliance_type}
                    </td>
                    <td>
                      {fmtDate(r.due_date)}{" "}
                      <span className="muted">({dueText(r.days)})</span>
                    </td>
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
                    <td className="muted">{fmtDate(r.last_completed_date)}</td>
                    <td>
                      <Link
                        className="btn ghost small"
                        href={`/compliance/${r.id}/edit`}
                      >
                        Edit
                      </Link>
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
