"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { parseFeet, feetLabel, fmtM, FT_TO_M } from "@/lib/precast";
import type { FormState } from "./actions";

type Product = { id: string; name: string };
type Person = { id: string; full_name: string };
type Row = {
  key: number;
  productId: string;
  name: string;
  length: string;
  qty: string;
  notes: string;
};

let seq = 1;
const blankRow = (): Row => ({
  key: seq++,
  productId: "",
  name: "",
  length: "",
  qty: "1",
  notes: "",
});

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
    const ft = parseFeet(r.length);
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
          Needed by
          <input
            name="required_date"
            type="date"
            defaultValue={d.required_date ?? ""}
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
        Order lines — type lengths in feet the way the customer says them
        (&ldquo;6ft6&rdquo;, &ldquo;10ft&rdquo;, &ldquo;8&rdquo;)
      </p>

      <div className="del-rows">
        {rows.map((r, i) => {
          const ft = parseFeet(r.length);
          const q = Number(r.qty) || 0;
          const lineM = ft != null ? ft * FT_TO_M * q : null;
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
              <div className="del-grid">
                <label>
                  Product
                  {products.length > 0 ? (
                    <select
                      name="product_id"
                      value={r.productId}
                      onChange={(e) => {
                        const p = products.find((x) => x.id === e.target.value);
                        patch(r.key, {
                          productId: e.target.value,
                          name: p?.name ?? r.name,
                        });
                      }}
                    >
                      <option value="">— choose / type —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input type="hidden" name="product_id" value="" />
                  )}
                </label>
                <label>
                  Product name / spec
                  <input
                    name="product_name"
                    value={r.name}
                    onChange={(e) => patch(r.key, { name: e.target.value })}
                    placeholder={'e.g. 2" face window sill'}
                  />
                </label>
                <label>
                  Length (feet)
                  <input
                    name="length_text"
                    value={r.length}
                    onChange={(e) => patch(r.key, { length: e.target.value })}
                    placeholder="6ft6"
                  />
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
                  ? `${feetLabel(ft)} each · = ${fmtM(ft * FT_TO_M)} each`
                  : r.length
                    ? "can't read that length"
                    : ""}
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
        Total to go on the docket: <strong>{fmtM(totalM)}</strong>
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
