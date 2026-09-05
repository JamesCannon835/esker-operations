"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { WEEKDAY_NAMES, type VbDay, type VbType, type VbWeek } from "@/lib/verti-block";
import { saveWeek, type FormState } from "./actions";

function Tick({
  name,
  value,
}: {
  name: string;
  value: boolean | null;
}) {
  return (
    <select name={name} defaultValue={value == null ? "" : value ? "yes" : "no"}>
      <option value="">—</option>
      <option value="yes">OK</option>
      <option value="no">Not OK</option>
    </select>
  );
}

export function WeekSheet({
  week,
  days,
  types,
}: {
  week: VbWeek;
  days: VbDay[];
  types: VbType[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    saveWeek.bind(null, week.id),
    {},
  );

  // counts[weekday][typeId] as strings for controlled inputs + live totals
  const [counts, setCounts] = useState<Record<number, Record<string, string>>>(
    () => {
      const init: Record<number, Record<string, string>> = {};
      for (const d of days) {
        init[d.weekday] = {};
        for (const t of types) {
          const v = d.counts?.[t.id];
          init[d.weekday][t.id] = v ? String(v) : "";
        }
      }
      return init;
    },
  );
  const [broken, setBroken] = useState<Record<number, Record<string, string>>>(
    () => {
      const init: Record<number, Record<string, string>> = {};
      for (const d of days) {
        init[d.weekday] = {};
        for (const t of types) {
          const v = d.broken?.[t.id];
          init[d.weekday][t.id] = v ? String(v) : "";
        }
      }
      return init;
    },
  );

  const dayTotal = (wd: number) =>
    Object.values(counts[wd] ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
  const dayBroken = (wd: number) =>
    Object.values(broken[wd] ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
  const weekTotal = [1, 2, 3, 4, 5].reduce((s, wd) => s + dayTotal(wd), 0);

  const byDay = new Map(days.map((d) => [d.weekday, d]));

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      <div className="card">
        <div className="del-grid">
          <label>
            Operator name
            <input name="operator_name" defaultValue={week.operator_name ?? ""} />
          </label>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label htmlFor="notes">Week notes</label>
          <textarea id="notes" name="notes" rows={2} defaultValue={week.notes ?? ""} />
        </div>
      </div>

      {[1, 2, 3, 4, 5].map((wd) => {
        const d = byDay.get(wd);
        if (!d) return null;
        return (
          <details className="vb-day" key={wd} open={wd === 1}>
            <summary>
              <strong>{WEEKDAY_NAMES[wd - 1]}</strong>{" "}
              <span className="muted">
                {new Date(`${d.day_date}T00:00:00`).toLocaleDateString("en-IE", {
                  day: "numeric",
                  month: "short",
                })}{" "}
                · {dayTotal(wd)} made
                {dayBroken(wd) > 0 ? ` · ${dayBroken(wd)} broken` : ""}
              </span>
            </summary>

            <div style={{ padding: "12px 0" }}>
              <div className="del-grid">
                <label>
                  Concrete ordered (m³)
                  <input
                    name={`d${wd}_concrete`}
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    defaultValue={d.concrete_ordered_m3 ?? ""}
                  />
                </label>
              </div>

              <p className="hint" style={{ margin: "12px 0 6px" }}>
                Blocks made
              </p>
              <div className="vb-counts">
                {types.map((t) => (
                  <label key={t.id}>
                    <span>{t.name}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      name={`d${wd}_c_${t.id}`}
                      value={counts[wd]?.[t.id] ?? ""}
                      onChange={(e) =>
                        setCounts((c) => ({
                          ...c,
                          [wd]: { ...c[wd], [t.id]: e.target.value },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>

              <p className="hint" style={{ margin: "16px 0 6px" }}>
                Blocks broken — enter a number per type
              </p>
              <div className="vb-counts">
                {types.map((t) => (
                  <label key={t.id}>
                    <span>{t.name}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      name={`d${wd}_b_${t.id}`}
                      value={broken[wd]?.[t.id] ?? ""}
                      onChange={(e) =>
                        setBroken((b) => ({
                          ...b,
                          [wd]: { ...b[wd], [t.id]: e.target.value },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>

              <div className="del-grid" style={{ marginTop: 12 }}>
                <label>
                  Waste concrete used (m³)
                  <input
                    name={`d${wd}_waste`}
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    defaultValue={d.waste_concrete_m3 ?? ""}
                  />
                </label>
              </div>

              <div className="vb-checks">
                <label>
                  Block visual inspection
                  <Tick name={`d${wd}_bv`} value={d.block_visual_ok} />
                </label>
                <label>
                  Mould visual inspection
                  <Tick name={`d${wd}_mv`} value={d.mould_visual_ok} />
                </label>
                <label>
                  Weight inspection
                  <Tick name={`d${wd}_wt`} value={d.weight_ok} />
                </label>
              </div>
            </div>
          </details>
        );
      })}

      <p className="hint">
        Week total: <strong>{weekTotal} blocks</strong>
      </p>

      <div className="btn-row">
        <button className="btn" type="submit">
          Save week
        </button>
        <Link className="btn ghost" href="/verti-block/sheets">
          Back
        </Link>
      </div>
    </form>
  );
}
