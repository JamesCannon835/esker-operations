export const FT_TO_M = 0.3048;

export const PRECAST_STATUS_LABELS: Record<string, string> = {
  new: "New",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export type PrecastProduct = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
};

export type PrecastOrder = {
  id: string;
  order_number: string | null;
  customer: string | null;
  phone: string | null;
  order_date: string;
  required_date: string | null;
  required_time: string | null;
  status: string;
  assigned_to: string | null;
  notes: string | null;
  done_at: string | null;
};

export type PrecastLine = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  length_ft: number | null;
  length_text: string | null;
  quantity: number;
  notes: string | null;
  sort_order: number;
};

/**
 * Parse a length typed by the yard in feet/inches into decimal feet.
 * Accepts "6.5", "6ft6", "6' 6\"", "6-6", "10ft", "10".
 * Returns null if it can't be read.
 */
export function parseFeet(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  // plain decimal feet, e.g. "6.5" or "10"
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);

  const m = s.match(
    /^(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|'|’|-|\s)\s*(\d+(?:\.\d+)?)?\s*(?:in|inch|inches|"|”|''|'')?\.?$/,
  );
  if (!m) {
    // "6ft" with no inches
    const only = s.match(/^(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|')\.?$/);
    return only ? Number(only[1]) : null;
  }
  const feet = Number(m[1]);
  const inches = m[2] != null ? Number(m[2]) : 0;
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;
  return feet + inches / 12;
}

/** Decimal feet -> a tidy "6ft 6in" style label. */
export function feetLabel(ft: number | null | undefined): string {
  if (ft == null) return "—";
  const whole = Math.floor(ft);
  const inches = Math.round((ft - whole) * 12);
  if (inches === 0) return `${whole}ft`;
  if (inches === 12) return `${whole + 1}ft`;
  return `${whole}ft ${inches}in`;
}

export function metres(ft: number | null | undefined): number | null {
  return ft == null ? null : Math.round(ft * FT_TO_M * 1000) / 1000;
}

export function fmtM(m: number | null | undefined): string {
  return m == null ? "—" : `${m.toFixed(2)} m`;
}

/** Total linear metres for a line (length × quantity). */
export function lineMetres(line: {
  length_ft: number | null;
  quantity: number;
}): number | null {
  if (line.length_ft == null) return null;
  return Math.round(line.length_ft * FT_TO_M * (line.quantity || 0) * 1000) / 1000;
}
