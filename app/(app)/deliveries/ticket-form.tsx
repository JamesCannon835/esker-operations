"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { fmtMoney } from "@/lib/format";
import { lineTotal } from "@/lib/deliveries";
import type { FormState } from "./actions";

type Supplier = { id: string; name: string };
type Product = {
  id: string;
  supplier_id: string;
  name: string;
  unit: string;
  unit_price: number | null;
};

export function TicketForm({
  action,
  suppliers,
  products,
  defaults,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  suppliers: Supplier[];
  products: Product[];
  defaults: {
    supplier_id: string;
    product_id: string | null;
    product_name: string;
    unit: string;
    quantity: number;
    unit_price: number | null;
    docket_number: string | null;
    delivered_on: string;
    vehicle_reg: string | null;
    notes: string | null;
  };
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const d = defaults;

  const [supplierId, setSupplierId] = useState(d.supplier_id);
  const [productId, setProductId] = useState(d.product_id ?? "");
  const [name, setName] = useState(d.product_name);
  const [unit, setUnit] = useState(d.unit);
  const [qty, setQty] = useState(String(d.quantity));
  const [price, setPrice] = useState(
    d.unit_price != null ? String(d.unit_price) : "",
  );

  const supplierProducts = products.filter((p) => p.supplier_id === supplierId);
  const total = lineTotal(Number(qty) || null, Number(price) || null);

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}
      <input type="hidden" name="product_name" value={name} />

      <div className="field">
        <label htmlFor="supplier_id">Supplier</label>
        <select
          id="supplier_id"
          name="supplier_id"
          value={supplierId}
          onChange={(e) => {
            setSupplierId(e.target.value);
            setProductId("");
          }}
        >
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="product_id">Product</label>
        {supplierProducts.length > 0 ? (
          <select
            id="product_id"
            name="product_id"
            value={productId}
            onChange={(e) => {
              const p = supplierProducts.find((x) => x.id === e.target.value);
              setProductId(e.target.value);
              if (p) {
                setName(p.name);
                setUnit(p.unit);
                if (p.unit_price != null) setPrice(String(p.unit_price));
              }
            }}
          >
            <option value="">— type below —</option>
            {supplierProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          <input type="hidden" name="product_id" value="" />
        )}
      </div>

      <div className="field">
        <label htmlFor="pn">Product name</label>
        <input
          id="pn"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="del-grid">
        <label>
          Tonnage
          <input
            name="quantity"
            type="number"
            step="0.01"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </label>
        <label>
          Unit
          <input
            name="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
        </label>
        <label>
          Price / unit (€)
          <input
            name="unit_price"
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <label>
          Docket no.
          <input name="docket_number" defaultValue={d.docket_number ?? ""} />
        </label>
        <label>
          Delivery date
          <input
            name="delivered_on"
            type="date"
            defaultValue={d.delivered_on}
          />
        </label>
        <label>
          Truck reg
          <input name="vehicle_reg" defaultValue={d.vehicle_reg ?? ""} />
        </label>
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={2} defaultValue={d.notes ?? ""} />
      </div>

      <p className="hint">
        Line total: <strong>{total != null ? fmtMoney(total) : "—"}</strong>
      </p>

      <div className="btn-row">
        <button className="btn" type="submit">
          Save
        </button>
        <Link className="btn ghost" href="/deliveries">
          Cancel
        </Link>
      </div>
    </form>
  );
}
