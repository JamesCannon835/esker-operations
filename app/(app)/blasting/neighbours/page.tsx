import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConfirmButton } from "@/components/confirm-button";
import { NeighbourForm } from "../neighbour-form";
import { saveNeighbour, deleteNeighbour } from "../actions";

export const dynamic = "force-dynamic";

export default async function NeighboursPage() {
  await requireManager();
  const supabase = await createClient();

  const { data: neighbours } = await supabase
    .from("neighbours")
    .select("id, name, phone, email, address, notes, active")
    .order("name");

  const rows = neighbours ?? [];
  const activeCount = rows.filter((n) => n.active).length;

  return (
    <>
      <Link className="link-back" href="/blasting">
        ← Blast notifications
      </Link>
      <div className="page-head">
        <h1>Neighbours</h1>
      </div>
      <p className="hint">
        {rows.length} on file · {activeCount} on the notification list. Turn
        someone off to keep them for the record without texting them.
      </p>

      <div className="card">
        {rows.length === 0 ? (
          <p className="empty">No neighbours added yet.</p>
        ) : (
          <table className="list-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Address</th>
                <th>On list</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id}>
                  <td>
                    <Link href={`/blasting/neighbours/${n.id}`}>{n.name}</Link>
                  </td>
                  <td className="muted">
                    {[n.phone, n.email].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="muted">{n.address ?? "—"}</td>
                  <td>
                    {n.active ? (
                      "Yes"
                    ) : (
                      <span className="blocked">Off</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <Link
                      className="btn ghost small"
                      href={`/blasting/neighbours/${n.id}`}
                    >
                      Edit
                    </Link>{" "}
                    <ConfirmButton
                      action={deleteNeighbour.bind(null, n.id)}
                      label="Delete"
                      className="btn ghost small"
                      confirmText={`Remove ${n.name} completely?`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Add a neighbour</h2>
        <NeighbourForm action={saveNeighbour.bind(null, null)} submitLabel="Add" />
      </div>
    </>
  );
}
