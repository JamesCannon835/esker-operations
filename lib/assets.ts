export const ASSET_STATUSES = [
  "available",
  "in_use",
  "maintenance",
  "breakdown",
  "off_road",
  "retired",
] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const STATUS_LABELS: Record<AssetStatus, string> = {
  available: "Available",
  in_use: "In use",
  maintenance: "Maintenance",
  breakdown: "Breakdown",
  off_road: "Off road",
  retired: "Retired",
};

export const FUEL_TYPES = [
  "Diesel",
  "Petrol",
  "Electric",
  "Hybrid",
  "HVO",
  "Other",
] as const;

/** Turns an empty string into null and trims, for optional text inputs. */
export function orNull(value: FormDataEntryValue | null): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

/** Parses an optional number field; empty -> null, invalid -> null. */
export function numOrNull(value: FormDataEntryValue | null): number | null {
  const s = orNull(value);
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Maps a Postgres/PostgREST error to a friendly message for the form. */
export function friendlyDbError(message: string): string {
  if (/duplicate key|already exists/i.test(message)) {
    return "That identifier is already in use by another record.";
  }
  if (/violates row-level security/i.test(message)) {
    return "You do not have permission to make this change.";
  }
  if (/invalid input syntax for type date/i.test(message)) {
    return "One of the dates is not valid.";
  }
  return message;
}
