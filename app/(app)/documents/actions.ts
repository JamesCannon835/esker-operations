"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orNull, friendlyDbError } from "@/lib/assets";
import { DOCUMENT_CATEGORIES, DOCUMENTS_BUCKET } from "@/lib/documents";

export type FormState = { error?: string };

/**
 * Called after the browser has uploaded the file to Storage. Records the
 * document row; `storage_path` is the path returned by the upload.
 */
export async function registerDocument(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const storagePath = orNull(formData.get("storage_path"));
  const assetRef = orNull(formData.get("asset"));
  const category = orNull(formData.get("category")) ?? "other";
  const expiry_date = orNull(formData.get("expiry_date"));

  if (!storagePath) return { error: "The file didn't upload — try again." };
  if (!assetRef || !assetRef.includes(":")) {
    return { error: "Choose the asset this document belongs to." };
  }
  if (!DOCUMENT_CATEGORIES.includes(category as never)) {
    return { error: "Pick a category." };
  }

  const [asset_type, asset_id] = assetRef.split(":");

  const { error } = await supabase.from("documents").insert({
    asset_type,
    asset_id,
    category,
    file_url: storagePath,
    uploaded_by: user.id,
    expiry_date,
  });

  if (error) {
    // best-effort cleanup of the orphaned upload
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
    return { error: friendlyDbError(error.message) };
  }

  revalidatePath("/documents");
  redirect("/documents");
}

export async function deleteDocument(id: string) {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("file_url")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw new Error(friendlyDbError(error.message));

  if (doc?.file_url) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.file_url]);
  }

  revalidatePath("/documents");
  redirect("/documents");
}
