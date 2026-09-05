import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { leaveYearRange } from "@/lib/leave";
import { getLeaveDefaultDays } from "@/lib/leave-server";
import { setAllowance } from "../actions";

export const dynamic = "force-dynamic";

export default async function LeaveAllowancesPage() {
  const { roles } = await requireManager();
  const supabase = await createClient();
  const { from, to, year } = leaveYearRange();

  const [{ data: people }, { data: allowances }, { data: taken }, defaultDays] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, full_name, active")
        .eq("active", true)
        .order("full_name"),
      supabase.from("leave_allowances").select("user_id, annual_days"),
      supabase
        .from("leave_requests")
        .select("user_id, working_days")
        .eq("leave_type", "annual")
        .eq("status", "approved")
        .gte("start_date", from)
        .lte("start_date", to),
      getLeaveDefaultDays(),
    ]);

  const setBy = new Map(
    (allowances ?? []).map((a) => [a.user_id, Number(a.annual_days)]),
  );
  const takenBy = new Map<string, number>();
  for (const r of taken ?? []) {
    takenBy.set(
      r.user_id,
      (takenBy.get(r.user_id) ?? 0) + Number(r.working_days),
    );
  }

  return (
    <>
      <Link className="link-back" href="/leave">
        ← Time off
      </Link>
      <div className="page-head">
        <h1>Leave allowances {year}</h1>
      </div>

      <p className="hint">
        Company default is <strong>{defaultDays} days</strong>
        {hasRole(roles, "admin") ? (
          <>
            {" "}
            — change it on <Link href="/admin/settings">Settings</Link>.
          </>
        ) : (
          " (an admin sets this)."
        )}{" "}
        Leave a person&apos;s box blank to use the default.
      </p>

      <div className="card">
        <table className="list-table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Entitlement (days)</th>
              <th>Taken</th>
              <th>Left</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(people ?? []).map((p) => {
              const explicit = setBy.get(p.id);
              const allowance = explicit ?? defaultDays;
              const used = takenBy.get(p.id) ?? 0;
              return (
                <tr key={p.id}>
                  <td>
                    <Link href={`/training/person/${p.id}`}>{p.full_name}</Link>
                  </td>
                  <td>
                    <form
                      action={setAllowance.bind(null, p.id)}
                      style={{ display: "flex", gap: 6 }}
                    >
                      <input
                        type="number"
                        name="annual_days"
                        min={0}
                        step={0.5}
                        defaultValue={explicit ?? ""}
                        placeholder={String(defaultDays)}
                        style={{ width: 90 }}
                      />
                      <button className="btn small ghost" type="submit">
                        Save
                      </button>
                    </form>
                  </td>
                  <td className="muted">{used}</td>
                  <td className="muted">{allowance - used}</td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {explicit == null ? "default" : "custom"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
