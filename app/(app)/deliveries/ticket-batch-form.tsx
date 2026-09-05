"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { fmtMoney } from "@/lib/format";
import { lineTotal } from "@/lib/deliveries";
import { createTickets, type FormState } from "./actions";

type Supplier = { id: string; name: string };
type Product = {
  id: string;
  supplier_id: string;
  name: string;
  unit: string;
  unit_price: number | null;
};
type Row = {
  key: number;
  productId: string;
  name: string;
  unit: string;
  qty: string;
  price: string;
  date: string;
  docket: string;
  reg: string;
};

const TODAY = new Date().toISOString().slice(0, 10);

let seq = 1;
const blankRow = (date: string): Row => ({
  key: seq++,
  productId: "",
  name: "",
  unit: "tonne",
  qty: "",
  price: "",
  date,
  docket: "",
  reg: "",
});

export function TicketBatchForm({
  suppliers,
  products,
  defaults,
}: {
  suppliers: Supplier[];
  products: Product[];
  defaults?: {
    supplier_id?: string;
    row?: Partial<Row>;
  };
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    createTickets,
    {},
  );

  const [supplierId, setSupplierId] = useState(defaults?.supplier_id ?? "");
  const [rows, setRows] = useState<Row[]>([
    { ...blankRow(TODAY), ...defaults?.row },
  ]);

  const supplierProducts = products.filter((p) => p.supplier_id === supplierId);

  function patch(key: number, next: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...next } : r)));
  }
  function pickProduct(key: number, productId: string) {
    const p = supplierProducts.find((x) => x.id === productId);
    patch(key, {
      productId,
      name: p?.name ?? "",
      unit: p?.unit ?? "tonne",
      price: p?.unit_price != null ? String(p.unit_price) : "",
    });
  }
  function addLine() {
    setRows((rs) => [
      ...rs,
      blankRow(rs[rs.length - 1]?.date || TODAY),
    ]);
  }

  const grand = rows.reduce(
    (sum, r) => sum + (lineTotal(Number(r.qty) || null, Number(r.price) || null) ?? 0),
    0,
  );

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}
      <input type="hidden" name="supplier_id" value={supplierId} />

      <div className="field">
        <label htmlFor="supplier">
          Supplier <span className="req">*</span>
        </label>
        <select
          id="supplier"
          value={supplierId}
          onChange={(e) => {
            setSupplierId(e.target.value);
            setRows((rs) =>
              rs.map((r) => ({ ...r, productId: "", name: "", price: "" })),
            );
          }}
          required
        >
          <option value="">— choose —</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {suppliers.length === 0 && (
          <div className="field-hint">
            No suppliers yet —{" "}
            <Link href="/deliveries/suppliers">add one first</Link>.
          </div>
        )}
      </div>

      <div className="del-rows">
        {rows.map((r, i) => {
          const total = lineTotal(
            Number(r.qty) || null,
            Number(r.price) || null,
          );
          return (
            <div className="del-row" key={r.key}>
              <div className="del-row-head">
                <strong>Line {i + 1}</strong>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() =>
                      setRows((rs) => [
                        ...rs,
                        { ...r, key: seq++, docket: "" },
                      ])
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
                  Delivery date <span className="req">*</span>
                  <input
                    name="delivered_on"
                    type="date"
                    value={r.date}
                    onChange={(e) => patch(r.key, { date: e.target.value })}
                  />
                </label>

                <label>
                  Product
                  {supplierProducts.length > 0 ? (
                    <select
                      name="product_id"
                      value={r.productId}
                      onChange={(e) => pickProduct(r.key, e.target.value)}
                    >
                      <option value="">— choose / type below —</option>
                      {supplierProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.unit_price != null
                            ? ` — ${fmtMoney(p.unit_price)}/${p.unit}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input type="hidden" name="product_id" value="" />
                  )}
                </label>

                <label>
                  {r.productId ? "Product name" : "Product (type it)"}
                  <input
                    name="product_name"
                    value={r.name}
                    onChange={(e) => patch(r.key, { name: e.target.value })}
                    placeholder="e.g. Washed sand"
                  />
                </label>

                <label>
                  Tonnage
                  <input
                    name="quantity"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={r.qty}
                    onChange={(e) => patch(r.key, { qty: e.target.value })}
                  />
                </label>

                <label>
                  Unit
                  <input
                    name="unit"
                    value={r.unit}
                    onChange={(e) => patch(r.key, { unit: e.target.value })}
                  />
                </label>

                <label>
                  Price / unit (€)
                  <input
                    name="unit_price"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={r.price}
                    onChange={(e) => patch(r.key, { price: e.target.value })}
                  />
                </label>

                <label>
                  Docket no.
                  <input
                    name="docket_number"
                    value={r.docket}
                    onChange={(e) => patch(r.key, { docket: e.target.value })}
                  />
                </label>

                <label>
                  Delivery truck reg
                  <input
                    name="vehicle_reg"
                    value={r.reg}
                    onChange={(e) => patch(r.key, { reg: e.target.value })}
                  />
                </label>
              </div>

              <div className="muted" style={{ fontSize: 13 }}>
                Line total: {total != null ? fmtMoney(total) : "—"}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ margin: "10px 0" }}>
        <button type="button" className="btn ghost small" onClick={addLine}>
          + Add line
        </button>
      </div>

      <p className="hint">
        {rows.length} {rows.length === 1 ? "ticket" : "tickets"} · estimated total{" "}
        <strong>{fmtMoney(grand)}</strong> · one ticket saved per line, each with
        its own date
      </p>

      <div className="btn-row">
        <button className="btn" type="submit">
          Save {rows.length === 1 ? "ticket" : `${rows.length} tickets`}
        </button>
        <Link className="btn ghost" href="/deliveries">
          Cancel
        </Link>
      </div>
    </form>
  );
}
