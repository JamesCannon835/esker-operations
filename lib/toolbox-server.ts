import { createClient } from "@/lib/supabase/server";

/**
 * Documents a manager can attach to a toolbox talk: everything under the
 * Health & Safety "Toolbox" folder (any depth). Falls back to all H&S
 * documents if there's no folder with "toolbox" in the name.
 */
export async function toolboxDocumentOptions(): Promise<
  { id: string; label: string }[]
> {
  const supabase = await createClient();

  const { data: folders } = await supabase
    .from("hs_folders")
    .select("id, name, parent_id")
    .eq("section", "health_safety");

  const all = folders ?? [];
  const roots = all.filter((f) => /toolbox/i.test(f.name)).map((f) => f.id);

  let allowed: Set<string> | null = null;
  if (roots.length > 0) {
    const byParent = new Map<string, string[]>();
    for (const f of all) {
      const arr = byParent.get(f.parent_id ?? "") ?? [];
      arr.push(f.id);
      byParent.set(f.parent_id ?? "", arr);
    }
    allowed = new Set<string>();
    const stack = [...roots];
    while (stack.length) {
      const cur = stack.pop()!;
      allowed.add(cur);
      for (const c of byParent.get(cur) ?? []) stack.push(c);
    }
  }

  let q = supabase
    .from("hs_documents")
    .select("id, name, folder_id")
    .eq("section", "health_safety")
    .eq("voided", false)
    .order("name");
  if (allowed) q = q.in("folder_id", [...allowed]);

  const { data: docs } = await q;
  return (docs ?? []).map((d) => ({ id: d.id, label: d.name }));
}
