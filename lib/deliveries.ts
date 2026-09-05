export type Supplier = {
  id: string;
  name: string;
  account_ref: string | null;
  contact: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
};

export type SupplierProduct = {
  id: string;
  supplier_id: string;
  name: string;
  unit: string;
  unit_price: number | null;
  active: boolean;
};

export type DeliveryTicket = {
  id: string;
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

export const DELIVERY_UNITS = ["tonne", "m³", "load", "bag", "each"] as const;

export function lineTotal(qty: number | null, price: number | null): number | null {
  if (qty == null || price == null) return null;
  return Math.round(qty * price * 100) / 100;
}
