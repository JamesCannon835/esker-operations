// Document library — one folder/document engine, several sections
// (Health & Safety, Quality, Environmental). All live in the `documents`
// storage bucket and the hs_folders / hs_documents tables, kept apart by
// a `section` tag. Access is management only (public.is_workshop()).

export const DOC_BUCKET = "documents";
export const DOC_MAX_BYTES = 40 * 1024 * 1024; // 40 MB per file

export const DOC_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";

export const DOC_SECTIONS = [
  "health_safety",
  "quality",
  "environmental",
] as const;
export type DocSection = (typeof DOC_SECTIONS)[number];

export const DOC_SECTION_META: Record<
  DocSection,
  { slug: string; title: string; prefix: string }
> = {
  health_safety: { slug: "health-safety", title: "Health & Safety", prefix: "hs" },
  quality: { slug: "quality", title: "Quality", prefix: "quality" },
  environmental: {
    slug: "environmental",
    title: "Environmental",
    prefix: "environmental",
  },
};

export function sectionFromSlug(slug: string): DocSection | null {
  return (
    (DOC_SECTIONS as readonly DocSection[]).find(
      (s) => DOC_SECTION_META[s].slug === slug,
    ) ?? null
  );
}

export type LibFolder = {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
};

export type LibDocument = {
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
  folders: LibFolder[],
): { id: string; label: string; depth: number }[] {
  const byParent = new Map<string | null, LibFolder[]>();
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
