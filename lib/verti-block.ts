export type VbType = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
  weight_kg?: number | null;
};

export type VbLoad = {
  id: string;
  reference: string | null;
  customer: string | null;
  load_date: string;
  truck_reg: string | null;
  max_payload_kg: number | null;
  status: "building" | "loaded" | "dispatched";
  notes: string | null;
};

export type VbLoadLine = {
  id: string;
  load_id: string;
  block_type_id: string;
  quantity: number;
  weight_kg: number | null;
};

export const LOAD_STATUS_LABELS: Record<string, string> = {
  building: "Building",
  loaded: "Loaded",
  dispatched: "Dispatched",
};

export function fmtKg(kg: number | null | undefined): string {
  if (kg == null) return "—";
  if (Math.abs(kg) >= 1000) return `${(kg / 1000).toFixed(2)} t`;
  return `${Math.round(kg)} kg`;
}

export type VbWeek = {
  id: string;
  week_commencing: string;
  operator_name: string | null;
  notes: string | null;
};

export type VbDay = {
  id: string;
  week_id: string;
  weekday: number; // 1..5
  day_date: string;
  concrete_ordered_m3: number | null;
  counts: Record<string, number>;
  blocks_broken: string | null;
  block_visual_ok: boolean | null;
  mould_visual_ok: boolean | null;
  weight_ok: boolean | null;
};

export const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

/** Monday of the week containing `d` (local). Returns an ISO yyyy-mm-dd. */
export function mondayOf(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const back = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - back);
  return x.toISOString().slice(0, 10);
}

/** yyyy-mm-dd for weekday n (1..5) of the week commencing `mondayISO`. */
export function dateForWeekday(mondayISO: string, weekday: number): string {
  const d = new Date(`${mondayISO}T00:00:00`);
  d.setDate(d.getDate() + (weekday - 1));
  return d.toISOString().slice(0, 10);
}

export function weekTotal(days: VbDay[]): number {
  let n = 0;
  for (const day of days) {
    for (const v of Object.values(day.counts ?? {})) n += Number(v) || 0;
  }
  return n;
}
