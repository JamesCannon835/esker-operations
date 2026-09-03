import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtNumber } from "@/lib/format";

type Props = {
  assetType: "vehicle" | "plant";
  assetId: string;
  currentReading: number | null;
  nextServiceReading: number | null; // km for vehicle, hours for plant
  nextServiceDate: string | null;
  canLog: boolean;
};

/** Service-due status + recent services for an asset detail page. */
export async function AssetServicePanel({
  assetType,
  assetId,
  currentReading,
  nextServiceReading,
  nextServiceDate,
  canLog,
}: Props) {
  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("id, service_date, mileage_or_hours, notes")
    .eq("asset_type", assetType)
    .eq("asset_id", assetId)
    .order("service_date", { ascending: false })
    .limit(5);

  const unit = assetType === "plant" ? "h" : "km";
  const today = new Date();
  const soon = new Date();
  soon.setDate(today.getDate() + 14);

  let dateStatus: "ok" | "amber" | "over" | "none" = "none";
  if (nextServiceDate) {
    const due = new Date(nextServiceDate);
    dateStatus = due < today ? "over" : due <= soon ? "amber" : "ok";
  }

  let readingStatus: "ok" | "amber" | "over" | "none" = "none";
  if (nextServiceReading != null && currentReading != null) {
    const remaining = nextServiceReading - currentReading;
    readingStatus = remaining < 0 ? "over" : remaining <= 500 ? "amber" : "ok";
  }

  const badge = (s: string) =>
    s === "over"
      ? { text: "Overdue", cls: "blocked" }
      : s === "amber"
        ? { text: "Due soon", cls: "" }
        : s === "ok"
          ? { text: "OK", cls: "ok" }
          : { text: "Not set", cls: "muted" };

  const d = badge(dateStatus);
  const r = badge(readingStatus);

  return (
    <div className="card">
      <h2 style={{ margin: 0 }}>Servicing</h2>
      <p className="hint">
        Services are recorded on the inspection where they were done.
      </p>

      <div className="detail-grid" style={{ marginTop: 12 }}>
        <div>
          <div className="label">Next service date</div>
          <div className="value">
            {fmtDate(nextServiceDate)}{" "}
            <span className={d.cls}>({d.text})</span>
          </div>
        </div>
        <div>
          <div className="label">Next service at</div>
          <div className="value">
            {nextServiceReading != null
              ? `${fmtNumber(nextServiceReading)} ${unit}`
              : "—"}{" "}
            <span className={r.cls}>({r.text})</span>
          </div>
        </div>
      </div>

      <h3 style={{ marginTop: 18, fontSize: 13, color: "var(--muted)" }}>
        RECENT SERVICES
      </h3>
      {!services || services.length === 0 ? (
        <p className="hint">None logged.</p>
      ) : (
        <table className="list-table">
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/services/${s.id}`}>
                    {fmtDate(s.service_date)}
                  </Link>
                </td>
                <td className="muted">
                  {s.mileage_or_hours != null
                    ? `${fmtNumber(s.mileage_or_hours)} ${unit}`
                    : "—"}
                </td>
                <td className="muted">
                  {s.notes
                    ? s.notes.length > 50
                      ? `${s.notes.slice(0, 50)}…`
                      : s.notes
                    : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
