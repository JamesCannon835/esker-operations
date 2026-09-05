"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { hasRole, isManager } from "@/lib/roles";
import { orNull, friendlyDbError } from "@/lib/assets";
import {
  DOC_BUCKET,
  DOC_SECTION_META,
  type DocSection,
} from "@/lib/doc-library";

export type FormState = { error?: string; ok?: boolean };

async function requireWorkshop() {
  const { user, roles } = await requireUser();
  if (!hasRole(roles, "mechanic") && !isManager(roles)) redirect("/dashboard");
  return { user, roles };
}

function touch() {
  revalidatePath("/library", "layout");
}

function base(section: DocSection) {
  return `/library/${DOC_SECTION_META[section].slug}`;
}

// ---- folders ----
export async function createFolder(
  section: DocSection,
  parentId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireWorkshop();
  const name = orNull(formData.get("name"));
  if (!name) return { error: "Give the folder a name." };
  const supabase = await createClient();
  const { error } = await supabase.from("hs_folders").insert({
    name,
    parent_id: parentId,
    section,
    created_by: user.id,
  });
  if (error) return { error: friendlyDbError(error.message) };
  touch();
  return { ok: true };
}

export async function renameFolder(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireWorkshop();
  const name = orNull(formData.get("name"));
  if (!name) return { error: "Name can't be blank." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("hs_folders")
    .update({ name })
    .eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };
  touch();
  return { ok: true };
}

async function descendantIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rootId: string,
): Promise<string[]> {
  const { data: all } = await supabase
    .from("hs_folders")
    .select("id, parent_id");
  const byParent = new Map<string, string[]>();
  for (const f of all ?? []) {
    const arr = byParent.get(f.parent_id ?? "") ?? [];
    arr.push(f.id);
    byParent.set(f.parent_id ?? "", arr);
  }
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    out.push(cur);
    for (const c of byParent.get(cur) ?? []) stack.push(c);
  }
  return out;
}

export async function moveFolder(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireWorkshop();
  const target = orNull(formData.get("target")); // "" = root
  const supabase = await createClient();

  if (target === id) return { error: "Can't move a folder into itself." };
  if (target) {
    const kin = await descendantIds(supabase, id);
    if (kin.includes(target)) {
      return { error: "Can't move a folder into one of its own subfolders." };
    }
  }
  const { error } = await supabase
    .from("hs_folders")
    .update({ parent_id: target || null })
    .eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };
  touch();
  return { ok: true };
}

export async function deleteFolder(section: DocSection, id: string) {
  await requireWorkshop();
  const supabase = await createClient();

  // Remove every file under this folder tree from storage first.
  const ids = await descendantIds(supabase, id);
  const { data: docs } = await supabase
    .from("hs_documents")
    .select("file_path")
    .in("folder_id", ids);
  const paths = (docs ?? []).map((d) => d.file_path).filter(Boolean);
  for (let i = 0; i < paths.length; i += 100) {
    await supabase.storage.from(DOC_BUCKET).remove(paths.slice(i, i + 100));
  }

  const { data: folder } = await supabase
    .from("hs_folders")
    .select("parent_id")
    .eq("id", id)
    .maybeSingle();
  await supabase.from("hs_folders").delete().eq("id", id); // cascades rows

  touch();
  redirect(folder?.parent_id ? `${base(section)}/f/${folder.parent_id}` : base(section));
}

// ---- documents ----
export async function registerUpload(
  section: DocSection,
  folderId: string | null,
  file: { path: string; name: string; size: number; type: string | null },
) {
  const { user } = await requireWorkshop();
  const supabase = await createClient();
  await supabase.from("hs_documents").insert({
    folder_id: folderId,
    section,
    name: file.name,
    file_path: file.path,
    file_size: file.size,
    content_type: file.type,
    uploaded_by: user.id,
  });
  touch();
}

export async function renameDocument(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireWorkshop();
  const name = orNull(formData.get("name"));
  if (!name) return { error: "Name can't be blank." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("hs_documents")
    .update({ name })
    .eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };
  touch();
  return { ok: true };
}

export async function moveDocument(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireWorkshop();
  const target = orNull(formData.get("target"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("hs_documents")
    .update({ folder_id: target || null })
    .eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };
  touch();
  return { ok: true };
}

export async function deleteDocument(id: string) {
  await requireWorkshop();
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("hs_documents")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();
  await supabase.from("hs_documents").delete().eq("id", id);
  if (doc?.file_path) {
    await supabase.storage.from(DOC_BUCKET).remove([doc.file_path]);
  }
  touch();
}
