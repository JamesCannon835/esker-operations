"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { orNull, friendlyDbError } from "@/lib/assets";
import { smsConfigured, sendSms } from "@/lib/sms";

export type FormState = { error?: string };

function refresh(id?: string) {
  revalidatePath("/blasting");
  revalidatePath("/blasting/neighbours");
  if (id) revalidatePath(`/blasting/${id}`);
}

// ---- neighbours -----------------------------------------------------
export async function saveNeighbour(
  id: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireManager();
  const supabase = await createClient();

  const name = orNull(formData.get("name"));
  const phone = orNull(formData.get("phone"));
  if (!name) return { error: "Enter a name." };
  if (!phone) return { error: "Enter a mobile number." };

  const row = {
    name,
    phone,
    address: orNull(formData.get("address")),
    notes: orNull(formData.get("notes")),
    active: formData.get("active") !== null,
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from("neighbours").update(row).eq("id", id)
    : await supabase
        .from("neighbours")
        .insert({ ...row, created_by: user.id });
  if (error) return { error: friendlyDbError(error.message) };

  refresh();
  redirect("/blasting/neighbours");
}

export async function deleteNeighbour(id: string) {
  await requireManager();
  const supabase = await createClient();
  const { error } = await supabase.from("neighbours").delete().eq("id", id);
  if (error) throw new Error(friendlyDbError(error.message));
  refresh();
}

// ---- templates ----------------------------------------------------
export async function saveTemplate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireManager();
  const supabase = await createClient();
  const name = orNull(formData.get("name"));
  const body = orNull(formData.get("body"));
  if (!name || !body) return { error: "Name and message are both needed." };
  const { error } = await supabase.from("sms_templates").insert({ name, body });
  if (error) return { error: friendlyDbError(error.message) };
  refresh();
  redirect("/blasting/templates");
}

export async function deleteTemplate(id: string) {
  await requireManager();
  const supabase = await createClient();
  await supabase.from("sms_templates").delete().eq("id", id);
  refresh();
}

// ---- notifications -----------------------------------------------
export async function createNotification(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireManager();
  const supabase = await createClient();

  const message = orNull(formData.get("message"));
  if (!message) return { error: "Write the message." };

  const recipientIds = formData.getAll("recipient").map(String).filter(Boolean);
  if (recipientIds.length === 0)
    return { error: "Pick at least one neighbour." };

  const { data: neighbours } = await supabase
    .from("neighbours")
    .select("id, name, phone")
    .in("id", recipientIds);
  if (!neighbours || neighbours.length === 0)
    return { error: "Those neighbours could not be found." };

  const { data: notif, error } = await supabase
    .from("blast_notifications")
    .insert({
      title: orNull(formData.get("title")),
      blast_at: orNull(formData.get("blast_at")),
      message,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error.message) };

  const { error: rErr } = await supabase
    .from("blast_notification_recipients")
    .insert(
      neighbours.map((n) => ({
        notification_id: notif.id,
        neighbour_id: n.id,
        name: n.name,
        phone: n.phone,
      })),
    );
  if (rErr) return { error: friendlyDbError(rErr.message) };

  refresh(notif.id);
  redirect(`/blasting/${notif.id}`);
}

export async function updateNotification(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireManager();
  const supabase = await createClient();

  const { data: n } = await supabase
    .from("blast_notifications")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!n) redirect("/blasting");
  if (n.status !== "draft")
    return { error: "This one has been sent — it can't be changed." };

  const message = orNull(formData.get("message"));
  if (!message) return { error: "Write the message." };

  const recipientIds = formData.getAll("recipient").map(String).filter(Boolean);
  if (recipientIds.length === 0)
    return { error: "Pick at least one neighbour." };

  const { error } = await supabase
    .from("blast_notifications")
    .update({
      title: orNull(formData.get("title")),
      blast_at: orNull(formData.get("blast_at")),
      message,
    })
    .eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };

  const { data: neighbours } = await supabase
    .from("neighbours")
    .select("id, name, phone")
    .in("id", recipientIds);

  // Draft only — nothing has been sent, so rebuild the recipient list.
  await supabase
    .from("blast_notification_recipients")
    .delete()
    .eq("notification_id", id);
  await supabase.from("blast_notification_recipients").insert(
    (neighbours ?? []).map((n) => ({
      notification_id: id,
      neighbour_id: n.id,
      name: n.name,
      phone: n.phone,
    })),
  );

  refresh(id);
  redirect(`/blasting/${id}`);
}

export async function deleteNotification(id: string) {
  await requireManager();
  const supabase = await createClient();
  await supabase.from("blast_notifications").delete().eq("id", id);
  refresh();
  redirect("/blasting");
}

/** Send the texts. Blocked until a texting service is connected. */
export async function sendNotification(id: string) {
  await requireManager();

  if (!smsConfigured()) {
    redirect(`/blasting/${id}?e=nosms`);
  }

  const { user } = await requireManager();
  const supabase = await createClient();

  const { data: notif } = await supabase
    .from("blast_notifications")
    .select("id, message, status")
    .eq("id", id)
    .maybeSingle();
  if (!notif || notif.status === "sent") redirect(`/blasting/${id}`);

  const { data: recips } = await supabase
    .from("blast_notification_recipients")
    .select("id, phone, status")
    .eq("notification_id", id);

  for (const r of recips ?? []) {
    if (r.status === "delivered" || r.status === "sent") continue;
    const res = await sendSms(r.phone, notif.message);
    await supabase
      .from("blast_notification_recipients")
      .update({
        status: res.ok ? "sent" : "failed",
        provider_ref: res.ref ?? null,
        error: res.error ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", r.id);
  }

  await supabase
    .from("blast_notifications")
    .update({ status: "sent", sent_by: user.id, sent_at: new Date().toISOString() })
    .eq("id", id);

  refresh(id);
  redirect(`/blasting/${id}`);
}

export async function resendFailed(id: string) {
  await requireManager();
  if (!smsConfigured()) redirect(`/blasting/${id}?e=nosms`);
  const supabase = await createClient();

  const { data: notif } = await supabase
    .from("blast_notifications")
    .select("message")
    .eq("id", id)
    .maybeSingle();
  if (!notif) redirect("/blasting");

  const { data: recips } = await supabase
    .from("blast_notification_recipients")
    .select("id, phone")
    .eq("notification_id", id)
    .eq("status", "failed");

  for (const r of recips ?? []) {
    const res = await sendSms(r.phone, notif.message);
    await supabase
      .from("blast_notification_recipients")
      .update({
        status: res.ok ? "sent" : "failed",
        provider_ref: res.ref ?? null,
        error: res.error ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", r.id);
  }
  refresh(id);
  redirect(`/blasting/${id}`);
}
