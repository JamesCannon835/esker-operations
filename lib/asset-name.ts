/**
 * Vehicle display name. We no longer collect a separate fleet number on
 * creation (fleet_number is set equal to the registration), so only show
 * both when they actually differ (older records, or edited by hand).
 */
export function vehicleName(
  fleetNumber?: string | null,
  registration?: string | null,
): string {
  const f = fleetNumber?.trim();
  const r = registration?.trim();
  if (f && r && f.toLowerCase() !== r.toLowerCase()) return `${f} · ${r}`;
  return r || f || "—";
}
