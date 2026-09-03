import { createClient } from "@/lib/supabase/server";

export async function getSetting(key: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

/** Yard-wide mechanic hourly rate in euro. 0 = not set (labour shown as time only). */
export async function getLabourRate(): Promise<number> {
  const v = await getSetting("labour_rate_per_hour");
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
