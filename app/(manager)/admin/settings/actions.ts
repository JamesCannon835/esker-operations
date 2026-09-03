"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { numOrNull, friendlyDbError } from "@/lib/assets";

export type FormState = { error?: string; ok?: string };

export async function saveSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { roles } = await requireUser();
  if (!hasRole(roles, "admin")) redirect("/dashboard");

  const rate = numOrNull(formData.get("labour_rate_per_hour"));
  if (rate == null || rate < 0) {
    return { error: "Enter the hourly rate as a number (0 to turn it off)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: "labour_rate_per_hour",
      value: String(rate),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath("/admin/settings");
  return { ok: "Saved." };
}
