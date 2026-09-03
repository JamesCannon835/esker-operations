// Unambiguous alphabet — no 0/O/1/I/L.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * A short login code to hand to a person, e.g. "esker-K7M2P".
 * Used as their initial password; they can change it after signing in.
 */
export function generateAccessCode(): string {
  let code = "";
  const bytes = new Uint32Array(5);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 5; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return `esker-${code}`;
}
