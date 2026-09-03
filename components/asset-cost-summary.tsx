import { createClient } from "@/lib/supabase/server";
import { getLabourRate } from "@/lib/settings";
import { formatDuration } from "@/lib/inspections";
import { fmtMoney } from "@/lib/format";

/** Time + money spent keeping one asset on the road. */
export async function AssetCostSummary({
  assetType,
  assetId,
  noun,
}: {
  assetType: "vehicle" | "plant" | "trailer";
  assetId: string;
  noun: string;
}) {
  const supabase = await createClient();

  const { data: faults } = await supabase
    .from("faults")
    .select("id")
    .eq("asset_type", assetType)
    .eq("asset_id", assetId)
    .eq("voided", false);
  const faultIds = (faults ?? []).map((f) => f.id);

  const [{ data: labour }, { data: parts }, { data: services }] =
    await Promise.all([
      faultIds.length
        ? supabase
            .from("labour_entries")
            .select("start_time, stop_time")
            .in("fault_id", faultIds)
        : Promise.resolve({ data: [] as { start_time: string; stop_time: string | null }[] }),
      faultIds.length
        ? supabase
            .from("parts_used")
            .select("total_cost")
            .in("fault_id", faultIds)
        : Promise.resolve({ data: [] as { total_cost: number | null }[] }),
      supabase
        .from("services")
        .select("labour_hours, cost")
        .eq("asset_type", assetType)
        .eq("asset_id", assetId),
    ]);

  const rate = await getLabourRate();

  let labourMs = 0;
  for (const l of labour ?? []) {
    if (l.stop_time) {
      labourMs +=
        new Date(l.stop_time).getTime() - new Date(l.start_time).getTime();
    }
  }
  const faultLabourHours = labourMs / 3_600_000;
  const serviceLabourHours = (services ?? []).reduce(
    (a, s) => a + Number(s.labour_hours ?? 0),
    0,
  );
  const workshopHours = faultLabourHours + serviceLabourHours;

  const partsCost = (parts ?? []).reduce(
    (a, p) => a + Number(p.total_cost ?? 0),
    0,
  );
  const serviceCost = (services ?? []).reduce(
    (a, s) => a + Number(s.cost ?? 0),
    0,
  );
  const labourCost = rate > 0 ? workshopHours * rate : 0;
  const total = partsCost + serviceCost + labourCost;

  const faultCount = faultIds.length;
  const serviceCount = (services ?? []).length;

  return (
    <div className="card">
      <h2 style={{ margin: 0 }}>Time &amp; cost on this {noun}</h2>
      <p className="hint">
        Across {faultCount} fault{faultCount === 1 ? "" : "s"} and {serviceCount}{" "}
        service{serviceCount === 1 ? "" : "s"} on record.
      </p>

      <div className="grid" style={{ marginTop: 4 }}>
        <div className="tile">
          <div className="label">Workshop time</div>
          <div className="value">{formatDuration(workshopHours * 3_600_000)}</div>
        </div>
        <div className="tile">
          <div className="label">Parts</div>
          <div className="value">{fmtMoney(partsCost)}</div>
        </div>
        <div className="tile">
          <div className="label">
            Labour{rate > 0 ? ` @ ${fmtMoney(rate)}/h` : ""}
          </div>
          <div className="value">
            {rate > 0 ? fmtMoney(labourCost) : "—"}
          </div>
        </div>
        <div className="tile">
          <div className="label">Total spend</div>
          <div className="value">{fmtMoney(total)}</div>
        </div>
      </div>

      {rate === 0 && (
        <p className="field-hint">
          Set a yard labour rate in <strong>Admin → Settings</strong> to cost
          workshop time.
        </p>
      )}
      {serviceCost > 0 && (
        <p className="field-hint">
          Total spend includes {fmtMoney(serviceCost)} of service costs entered
          before labour hours were tracked.
        </p>
      )}
    </div>
  );
}
