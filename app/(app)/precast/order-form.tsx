"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  parseFeet,
  feetLabel,
  fmtM,
  FT_TO_M,
  PRECAST_LENGTHS,
} from "@/lib/precast";
import type { FormState } from "./actions";

type Product = { id: string; name: string };
type Person = { id: string; full_name: string };
type Row = {
  key: number;
  productId: string;
  name: string;
  length: string;
  other: boolean;
  qty: string;
  notes: string;
};

let seq = 1;
const blankRow = (): Row => ({
  key: seq++,
  productId: "",
  name: "",
  length: "",
  other: false,
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
        Order lines — pick the product and length as the customer gives them (in
        feet); the docket total comes out in metres.
      </p>

      <div className="del-rows">
        {rows.map((r, i) => {
          const other =
            r.other || (r.length !== "" && !PRECAST_LENGTHS.includes(r.length));
          const ft = parseFeet(r.length);
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
                  Length
                  <select
                    name="length_text"
                    value={other ? "__other" : r.length}
                    onChange={(e) =>
                      patch(r.key, {
                        length: e.target.value === "__other" ? "" : e.target.value,
                        other: e.target.value === "__other",
                      })
                    }
                  >
                    <option value="">— length —</option>
                    {PRECAST_LENGTHS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                    <option value="__other">Other…</option>
                  </select>
                  <input
                    name="length_custom"
                    value={other ? r.length : ""}
                    onChange={(e) => patch(r.key, { length: e.target.value })}
                    placeholder="e.g. 13ft6"
                    hidden={!other}
                    style={{ marginTop: 4 }}
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
                  ? `${feetLabel(ft)} each = ${fmtM(ft * FT_TO_M)}`
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
