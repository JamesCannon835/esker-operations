"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orNull, numOrNull, friendlyDbError } from "@/lib/assets";

export type FormState = { error?: string };

function readTrailer(formData: FormData) {
  return {
    registration: orNull(formData.get("registration")),
    trailer_type: orNull(formData.get("trailer_type")),
    make: orNull(formData.get("make")),
    model: orNull(formData.get("model")),
    year: numOrNull(formData.get("year")),
    vin: orNull(formData.get("vin")),
    assigned_vehicle_id: orNull(formData.get("assigned_vehicle_id")),
    notes: orNull(formData.get("notes")),
  };
}

export async function createTrailer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = readTrailer(formData);
  if (!values.registration) {
    return { error: "Registration is required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trailers")
    .insert(values)
    .select("id")
    .single();

  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath("/trailers");
  redirect(`/trailers/${data.id}`);
}

export async function updateTrailer(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = readTrailer(formData);
  if (!values.registration) {
    return { error: "Registration is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("trailers")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: friendlyDbError(error.message) };

  revalidatePath("/trailers");
  revalidatePath(`/trailers/${id}`);
  redirect(`/trailers/${id}`);
}

export async function setTrailerVoided(id: string, voided: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("trailers")
    .update({ voided, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(friendlyDbError(error.message));

  revalidatePath("/trailers");
  revalidatePath(`/trailers/${id}`);
  redirect(`/trailers/${id}`);
}
