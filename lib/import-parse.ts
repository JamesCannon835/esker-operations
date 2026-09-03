/** Shared helpers for the paste-to-import screens. */

export type ParsedTable = {
  headers: string[];
  rows: string[][];
};

/**
 * Parses pasted spreadsheet text. Accepts tab-separated (copied straight from
 * Excel) or comma-separated. The first non-empty line is treated as headers.
 */
export function parseTable(text: string): ParsedTable {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };

  const delim = lines[0].includes("\t") ? "\t" : ",";
  const split = (l: string) => l.split(delim).map((c) => c.trim());

  const headers = split(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map(split);
  return { headers, rows };
}

/** Finds the first column whose header contains any of the given needles. */
export function colIndex(headers: string[], ...needles: string[]): number {
  return headers.findIndex((h) => needles.some((n) => h.includes(n)));
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/**
 * Parses a date cell into an ISO yyyy-mm-dd string, or null.
 * Handles dd/mm/yyyy, d-m-yy, yyyy-mm-dd and raw Excel serial numbers.
 */
export function parseImportDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (s === "") return null;

  // Excel serial number
  if (/^\d{4,6}$/.test(s)) {
    const n = Number(s);
    if (n > 20000 && n < 80000) {
      return new Date(EXCEL_EPOCH + n * 86_400_000).toISOString().slice(0, 10);
    }
  }

  // yyyy-mm-dd
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]);

  // dd/mm/yyyy or dd-mm-yy (Irish order)
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    let year = +m[3];
    if (year < 100) year += year < 70 ? 2000 : 1900;
    return iso(year, +m[2], +m[1]);
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function iso(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "211 G 2279" / "211g2279" -> "211-G-2279". Leaves anything odd cleaned but intact. */
export function normaliseReg(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  const m = s.match(/^(\d{2,3})([A-Z]{1,3})(\d{1,6})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : raw.trim().toUpperCase();
}

/** Basic email shape check. */
export function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}
