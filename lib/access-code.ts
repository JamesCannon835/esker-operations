/**
 * A 6-digit login code to hand to a person, e.g. "482915".
 * Used as their initial password; they can change it after signing in.
 *
 * Note: Supabase Auth must allow a minimum password length of 6
 * (Authentication → Policies → Minimum password length). 6 is the default.
 */
export function generateAccessCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}
