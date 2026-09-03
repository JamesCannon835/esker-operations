import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/roles";
import { vehicleName } from "@/lib/asset-name";

/** People who can be assigned to an asset, for the assignment dropdowns. */
export type AssignablePerson = { id: string; full_name: string };

export async function getPeopleByRole(role: Role): Promise<AssignablePerson[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("id, full_name, active, user_roles!inner(role)")
    .eq("user_roles.role", role)
    .eq("active", true)
    .order("full_name");

  return (data ?? []).map((u) => ({ id: u.id, full_name: u.full_name }));
}

export function getAssignablePeople(
  role: Extract<Role, "driver" | "plant_operator">,
): Promise<AssignablePerson[]> {
  return getPeopleByRole(role);
}

export function getMechanics(): Promise<AssignablePerson[]> {
  return getPeopleByRole("mechanic");
}

/** Vehicles available to tow a trailer. */
export async function getVehiclesForAssignment(): Promise<
  { id: string; label: string }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vehicles")
    .select("id, fleet_number, registration")
    .eq("voided", false)
    .order("fleet_number");

  return (data ?? []).map((v) => ({
    id: v.id,
    label: vehicleName(v.fleet_number, v.registration),
  }));
}
