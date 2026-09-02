// The app is used in Ireland; force D/M/Y regardless of server locale
// (Vercel's servers default to en-US).
const LOCALE = "en-IE";

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(LOCALE);
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtNumber(n: number | null | undefined, suffix = ""): string {
  if (n == null) return "—";
  return `${Number(n).toLocaleString(LOCALE)}${suffix}`;
}
