"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/assets";

export async function deleteService(id: string) {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("services")
    .select("asset_type, asset_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw new Error(friendlyDbError(error.message));

  revalidatePath("/inspections");
  if (doc) {
    redirect(
      doc.asset_type === "plant"
        ? `/plant/${doc.asset_id}`
        : doc.asset_type === "trailer"
          ? `/trailers/${doc.asset_id}`
          : `/vehicles/${doc.asset_id}`,
    );
  }
  redirect("/dashboard");
}
