"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { orNull, friendlyDbError } from "@/lib/assets";
import { isValidSignature } from "@/lib/toolbox";

export type FormState = { error?: string };

function refresh(id?: string) {
  revalidatePath("/toolbox");
  if (id) revalidatePath(`/toolbox/${id}`);
  revalidatePath("/dashboard");
}

async function requireManagerUser() {
  const s = await requireUser();
  if (!isManager(s.roles)) redirect("/dashboard");
  return s;
}

function readRecipients(formData: FormData): string[] {
  return formData
    .getAll("recipient")
    .map((v) => String(v))
    .filter(Boolean);
}

export async function createTalk(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requireManagerUser();
  const supabase = await createClient();

  const title = orNull(formData.get("title"));
  const talk_date = orNull(formData.get("talk_date"));
  const body = orNull(formData.get("body"));
  const document_id = orNull(formData.get("document_id"));
  const recipients = readRecipients(formData);

  if (!title) return { error: "Give the talk a title." };
  if (!talk_date) return { error: "Pick the date / week." };
  if (!body && !document_id)
    return { error: "Add some text or attach a document." };
  if (recipients.length === 0)
    return { error: "Choose at least one person to send it to." };

  const { data: talk, error } = await supabase
    .from("toolbox_talks")
    .insert({
      title,
      talk_date,
      body,
      document_id,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error.message) };

  const { error: rErr } = await supabase.from("toolbox_talk_recipients").insert(
    recipients.map((uid) => ({ talk_id: talk.id, user_id: uid })),
  );
  if (rErr) return { error: friendlyDbError(rErr.message) };

  refresh(talk.id);
  redirect(`/toolbox/${talk.id}`);
}

export async function updateTalk(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireManagerUser();
  const supabase = await createClient();

  const { data: talk } = await supabase
    .from("toolbox_talks")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!talk) redirect("/toolbox");
  if (talk.status !== "draft")
    return { error: "This talk has been sent — it can't be edited now." };

  const title = orNull(formData.get("title"));
  const talk_date = orNull(formData.get("talk_date"));
  const body = orNull(formData.get("body"));
  const document_id = orNull(formData.get("document_id"));
  const recipients = readRecipients(formData);

  if (!title) return { error: "Give the talk a title." };
  if (!talk_date) return { error: "Pick the date / week." };
  if (!body && !document_id)
    return { error: "Add some text or attach a document." };
  if (recipients.length === 0)
    return { error: "Choose at least one person." };

  const { error } = await supabase
    .from("toolbox_talks")
    .update({ title, talk_date, body, document_id })
    .eq("id", id);
  if (error) return { error: friendlyDbError(error.message) };

  // Draft only, so nobody has signed — safe to rebuild the recipient list.
  await supabase.from("toolbox_talk_recipients").delete().eq("talk_id", id);
  await supabase
    .from("toolbox_talk_recipients")
    .insert(recipients.map((uid) => ({ talk_id: id, user_id: uid })));

  refresh(id);
  redirect(`/toolbox/${id}`);
}

export async function sendTalk(id: string) {
  await requireManagerUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("toolbox_talks")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft");
  if (error) throw new Error(friendlyDbError(error.message));
  refresh(id);
}

export async function deleteTalk(id: string) {
  await requireManagerUser();
  const supabase = await createClient();
  const { error } = await supabase.from("toolbox_talks").delete().eq("id", id);
  if (error) throw new Error(friendlyDbError(error.message));
  refresh(id);
  redirect("/toolbox");
}

/** The recipient signs — records their drawn signature against their row. */
export async function signTalk(talkId: string, formData: FormData) {
  const { user } = await requireUser();
  const supabase = await createClient();

  const signature = String(formData.get("signature") ?? "");
  if (!isValidSignature(signature)) {
    redirect(`/toolbox/${talkId}?e=sig`);
  }

  const { data: row } = await supabase
    .from("toolbox_talk_recipients")
    .select("id, signed_at")
    .eq("talk_id", talkId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) redirect("/toolbox");
  if (row.signed_at) redirect(`/toolbox/${talkId}`); // already done

  const { error } = await supabase
    .from("toolbox_talk_recipients")
    .update({ signed_at: new Date().toISOString(), signature_data: signature })
    .eq("id", row.id);
  if (error) throw new Error(friendlyDbError(error.message));

  refresh(talkId);
  redirect(`/toolbox/${talkId}`);
}

/** Manager clears a signature (e.g. signed by mistake) so the person can re-sign. */
export async function clearSignature(recipientId: string, talkId: string) {
  await requireManagerUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("toolbox_talk_recipients")
    .update({ signed_at: null, signature_data: null })
    .eq("id", recipientId);
  if (error) throw new Error(friendlyDbError(error.message));
  refresh(talkId);
}
