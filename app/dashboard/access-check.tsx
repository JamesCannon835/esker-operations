import { createClient } from "@/lib/supabase/server";
import { isManager, hasRole, type Role } from "@/lib/roles";

/**
 * Probes each RLS-sensitive table with a COUNT query and reports how many
 * rows the current user can see. Row Level Security filters rows silently:
 * a role with no access gets 0 rows, not an error. Seed the sample data
 * (see README) so the numbers actually differ between roles.
 */

type Probe = {
  table: string;
  /** What this role is expected to see, for eyeballing pass/fail. */
  expectation: (roles: Role[]) => string;
};

const PROBES: Probe[] = [
  { table: "vehicles", expectation: () => "all rows" },
  { table: "plant", expectation: () => "all rows" },
  { table: "compliance_items", expectation: () => "all rows" },
  { table: "inspections", expectation: () => "all rows" },
  { table: "faults", expectation: () => "all rows" },
  {
    table: "labour_entries",
    expectation: (r) =>
      isManager(r) ? "all rows" : hasRole(r, "mechanic") ? "own rows only" : "0 — no access",
  },
  {
    table: "parts_used",
    expectation: (r) =>
      isManager(r) || hasRole(r, "mechanic") ? "all rows" : "0 — no access",
  },
  {
    table: "audit_log",
    expectation: (r) => (isManager(r) ? "all rows" : "0 — no access"),
  },
  {
    table: "users",
    expectation: (r) => (isManager(r) ? "all rows" : "1 — own row only"),
  },
  {
    table: "user_roles",
    expectation: (r) => (isManager(r) ? "all rows" : "own roles only"),
  },
];

export async function AccessCheck({ roles }: { roles: Role[] }) {
  const supabase = await createClient();

  const results = await Promise.all(
    PROBES.map(async (probe) => {
      const { count, error } = await supabase
        .from(probe.table)
        .select("*", { count: "exact", head: true });
      return {
        table: probe.table,
        count: count ?? 0,
        error: error?.message ?? null,
        expectation: probe.expectation(roles),
      };
    }),
  );

  return (
    <div className="card">
      <h2>Data access check</h2>
      <p className="hint">
        Live COUNT queries run as <strong>you</strong>, through Row Level
        Security. Sign in as each role and compare the “rows visible” column to
        “expected”. RLS never errors on a blocked read — it just returns 0 rows.
      </p>
      <table>
        <thead>
          <tr>
            <th>Table</th>
            <th>Rows visible</th>
            <th>Expected for your role(s)</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.table}>
              <td>
                <code>{r.table}</code>
              </td>
              <td>
                {r.error ? (
                  <span className="blocked">error: {r.error}</span>
                ) : (
                  <span className={r.count > 0 ? "ok" : ""}>{r.count}</span>
                )}
              </td>
              <td>{r.expectation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
