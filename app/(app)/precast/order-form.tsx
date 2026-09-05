"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { feetLabel, fmtM, FT_TO_M } from "@/lib/precast";
import type { FormState } from "./actions";

type Product = { id: string; name: string };
type Person = { id: string; full_name: string };
type Row = {
  key: number;
  productId: string;
  name: string;
  feet: string;
  inches: string;
  qty: string;
  notes: string;
};

const FEET = Array.from({ length: 11 }, (_, i) => i + 2); // 2..12
const INCHES = Array.from({ length: 12 }, (_, i) => i); // 0..11

let seq = 1;
const blankRow = (): Row => ({
  key: seq++,
  productId: "",
  name: "",
  feet: "",
  inches: "0",
  qty: "1",
  notes: "",
});

function rowFeet(r: Row): number | null {
  const f = Number(r.feet);
  if (!Number.isFinite(f) || f <= 0) return null;
  return f + (Number(r.inches) || 0) / 12;
}

export function OrderForm({
  action,
  products,
  people,
  defaults,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  products: Product[];
  people: Person[];
  defaults?: {
    customer?: string | null;
    phone?: string | null;
    required_date?: string | null;
    required_time?: string | null;
    assigned_to?: string | null;
    notes?: string | null;
    lines?: Row[];
  };
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const d = defaults ?? {};
  const [rows, setRows] = useState<Row[]>(
    d.lines && d.lines.length ? d.lines : [blankRow()],
  );

  function patch(key: number, next: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...next } : r)));
  }

  let totalM = 0;
  for (const r of rows) {
    const ft = rowFeet(r);
    const q = Number(r.qty) || 0;
    if (ft != null) totalM += ft * FT_TO_M * q;
  }

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      <div className="del-grid">
        <label>
          Customer
          <input name="customer" defaultValue={d.customer ?? ""} />
        </label>
        <label>
          Phone
          <input name="phone" type="tel" defaultValue={d.phone ?? ""} />
        </label>
        <label>
          Needed by (date)
          <input
            name="required_date"
            type="date"
            defaultValue={d.required_date ?? ""}
          />
        </label>
        <label>
          Time / when
          <input
            name="required_time"
            defaultValue={d.required_time ?? ""}
            placeholder='"first round", "8am", "second load"'
          />
        </label>
        <label>
          Give it to (yard)
          <select name="assigned_to" defaultValue={d.assigned_to ?? ""}>
            <option value="">— anyone —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="hint" style={{ margin: "14px 0 6px" }}>
        Order lines — pick the product, then the length in feet and inches. The
        docket total is worked out in metres.
      </p>

      <div className="del-rows">
        {rows.map((r, i) => {
          const ft = rowFeet(r);
          const q = Number(r.qty) || 0;
          const lineM = ft != null ? ft * FT_TO_M * q : null;
          const productName =
            products.find((p) => p.id === r.productId)?.name ?? r.name;
          return (
            <div className="del-row" key={r.key}>
              <div className="del-row-head">
                <strong>Line {i + 1}</strong>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() =>
                      setRows((rs) => [...rs, { ...r, key: seq++ }])
                    }
                  >
                    Duplicate
                  </button>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      className="btn ghost small"
                      onClick={() =>
                        setRows((rs) => rs.filter((x) => x.key !== r.key))
                      }
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <input type="hidden" name="product_name" value={productName} />
              <input
                type="hidden"
                name="length_text"
                value={ft != null ? feetLabel(ft) : ""}
              />
              <div className="del-grid">
                <label>
                  Product
                  <select
                    name="product_id"
                    value={r.productId}
                    onChange={(e) =>
                      patch(r.key, { productId: e.target.value })
                    }
                  >
                    <option value="">— choose —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Feet
                  <select
                    name="length_ft_whole"
                    value={r.feet}
                    onChange={(e) => patch(r.key, { feet: e.target.value })}
                  >
                    <option value="">—</option>
                    {FEET.map((f) => (
                      <option key={f} value={f}>
                        {f} ft
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Inches
                  <select
                    name="length_in"
                    value={r.inches}
                    onChange={(e) => patch(r.key, { inches: e.target.value })}
                  >
                    {INCHES.map((n) => (
                      <option key={n} value={n}>
                        {n} in
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantity
                  <input
                    name="quantity"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={r.qty}
                    onChange={(e) => patch(r.key, { qty: e.target.value })}
                  />
                </label>
                <label>
                  Note (optional)
                  <input
                    name="line_notes"
                    value={r.notes}
                    onChange={(e) => patch(r.key, { notes: e.target.value })}
                  />
                </label>
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                {ft != null
                  ? `${feetLabel(ft)} = ${fmtM(ft * FT_TO_M)} each`
                  : "pick a length"}
                {lineM != null ? ` · line total ${fmtM(lineM)}` : ""}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ margin: "10px 0" }}>
        <button
          type="button"
          className="btn ghost small"
          onClick={() => setRows((rs) => [...rs, blankRow()])}
        >
          + Add line
        </button>
      </div>

      <div className="field">
        <label htmlFor="notes">Order notes</label>
        <textarea id="notes" name="notes" rows={2} defaultValue={d.notes ?? ""} />
      </div>

      <p className="hint">
        Total for the docket: <strong>{fmtM(totalM)}</strong>
      </p>

      <div className="btn-row">
        <button className="btn" type="submit">
          {submitLabel}
        </button>
        <Link className="btn ghost" href="/precast">
          Cancel
        </Link>
      </div>
    </form>
  );
}
