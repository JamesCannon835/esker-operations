export const ROLES = [
  "driver",
  "plant_operator",
  "mechanic",
  "transport_manager",
  "admin",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  driver: "Driver",
  plant_operator: "Plant Operator",
  mechanic: "Mechanic",
  transport_manager: "Transport Manager",
  admin: "Admin / Management",
};

/** Admin or Transport Manager — mirrors public.is_manager() in the database. */
export function isManager(roles: Role[]): boolean {
  return roles.includes("admin") || roles.includes("transport_manager");
}

export function hasRole(roles: Role[], role: Role): boolean {
  return roles.includes(role);
}
