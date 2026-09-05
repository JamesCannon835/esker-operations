// Health & Safety document library — shared constants + helpers.

export const HS_BUCKET = "documents";
export const HS_PREFIX = "hs";
export const HS_MAX_BYTES = 40 * 1024 * 1024; // 40 MB per file

export const HS_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";

export type HsFolder = {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
};

export type HsDocument = {
  id: string;
  folder_id: string | null;
  name: string;
  file_path: string;
  file_size: number | null;
  content_type: string | null;
  uploaded_at: string;
};

export function fmtBytes(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Strip a leading "3. " / "12 - " ordering prefix for display. */
export function tidyFolderName(name: string): string {
  return name.replace(/^\s*\d+\s*[.\-]\s*/, "").trim() || name;
}

export function sortOrderFromName(name: string): number {
  const m = name.match(/^\s*(\d+)\s*[.\-\s]/);
  return m ? parseInt(m[1], 10) : 500;
}

/** Flatten a folder list into indented path options for a move picker. */
export function folderPaths(
  folders: HsFolder[],
): { id: string; label: string; depth: number }[] {
  const byParent = new Map<string | null, HsFolder[]>();
  for (const f of folders) {
    const arr = byParent.get(f.parent_id) ?? [];
    arr.push(f);
    byParent.set(f.parent_id, arr);
  }
  for (const arr of byParent.values()) {
    arr.sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    );
  }
  const out: { id: string; label: string; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const f of byParent.get(parent) ?? []) {
      out.push({ id: f.id, label: `${"— ".repeat(depth)}${f.name}`, depth });
      walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}
