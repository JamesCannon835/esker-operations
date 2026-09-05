"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { fmtMoney } from "@/lib/format";
import { fmtKg, type VbType, type VbLoad, type VbLoadLine } from "@/lib/verti-block";
import { saveLoadLines, type FormState } from "./actions";

export function LoadBuilder({
  load,
  lines,
  types,
}: {
  load: VbLoad;
  lines: VbLoadLine[];
  types: VbType[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    saveLoadLines.bind(null, load.id),
    {},
  );

  const startQty: Record<string, string> = {};
  for (const t of types) {
    const l = lines.find((x) => x.block_type_id === t.id);
    startQty[t.id] = l && l.quantity ? String(l.quantity) : "";
  }
  const [qty, setQty] = useState<Record<string, string>>(startQty);

  let totalBlocks = 0;
  let totalKg = 0;
  let totalValue = 0;
  let missingWeight = false;
  for (const t of types) {
    const n = Number(qty[t.id]) || 0;
    totalBlocks += n;
    if (n > 0) {
      if (t.weight_kg == null) missingWeight = true;
      else totalKg += n * Number(t.weight_kg);
      if (t.unit_price != null) totalValue += n * Number(t.unit_price);
    }
  }

  const cap = load.max_payload_kg ?? null;
  const pct = cap ? Math.min(100, Math.round((totalKg / cap) * 100)) : 0;
  const over = cap != null && totalKg > cap;
  const remaining = cap != null ? cap - totalKg : null;

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      <div className="card vb-load-summary">
        <div className="grid">
          <div className="tile">
            <div className="label">Blocks on load</div>
            <div className="value">{totalBlocks}</div>
          </div>
          <div className="tile">
            <div className="label">Total weight</div>
            <div className="value">{fmtKg(totalKg)}</div>
          </div>
          <div className="tile">
            <div className="label">Load value</div>
            <div className="value">{fmtMoney(totalValue)}</div>
          </div>
          {cap != null && (
            <div className="tile">
              <div className="label">{over ? "Over by" : "Room left"}</div>
              <div
                className="value"
                style={{ color: over ? "var(--danger)" : undefined }}
              >
                {fmtKg(Math.abs(remaining ?? 0))}
              </div>
            </div>
          )}
        </div>
        {cap != null && (
          <div className="vb-cap">
            <div className="vb-cap-track">
              <div
                className={`vb-cap-fill${over ? " over" : ""}`}
                style={{ width: `${over ? 100 : pct}%` }}
              />
            </div>
            <div className="hint">
              {fmtKg(totalKg)} of {fmtKg(cap)} payload
              {over ? " — OVERLOADED" : ""}
            </div>
          </div>
        )}
        {missingWeight && (
          <p className="hint">
            Some blocks on this load have no weight set —{" "}
            <Link href="/verti-block/types">add weights</Link> for an accurate
            total.
          </p>
        )}
      </div>

      <div className="card">
        <h2>Build the load</h2>
        <div className="vb-load-lines">
          {types.map((t) => {
            const n = Number(qty[t.id]) || 0;
            const lineKg = t.weight_kg != null ? n * Number(t.weight_kg) : null;
            const lineVal =
              t.unit_price != null ? n * Number(t.unit_price) : null;
            return (
              <div className="vb-load-line" key={t.id}>
                <div className="vb-load-name">
                  {t.name}
                  <span className="muted" style={{ fontSize: 12 }}>
                    {" "}
                    {t.weight_kg != null
                      ? `${fmtKg(t.weight_kg)} each`
                      : "no weight"}
                    {t.unit_price != null ? ` · ${fmtMoney(t.unit_price)}` : ""}
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  name={`qty_${t.id}`}
                  value={qty[t.id] ?? ""}
                  onChange={(e) =>
                    setQty((q) => ({ ...q, [t.id]: e.target.value }))
                  }
                />
                <div className="muted vb-load-linekg">
                  {n > 0 && lineKg != null ? fmtKg(lineKg) : ""}
                  {n > 0 && lineVal != null ? ` · ${fmtMoney(lineVal)}` : ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="btn-row">
        <button className="btn" type="submit">
          Save load
        </button>
        <Link className="btn ghost" href="/verti-block/loads">
          Back
        </Link>
      </div>
    </form>
  );
}
