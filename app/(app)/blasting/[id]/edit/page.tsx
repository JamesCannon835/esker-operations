import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NotificationForm } from "../../notification-form";
import { updateNotification } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditNotificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireManager();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: n }, { data: neighbours }, { data: templates }, { data: recs }] =
    await Promise.all([
      supabase
        .from("blast_notifications")
        .select("id, title, blast_at, message, status")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("neighbours")
        .select("id, name, address")
        .eq("active", true)
        .order("name"),
      supabase.from("sms_templates").select("id, name, body").order("name"),
      supabase
        .from("blast_notification_recipients")
        .select("neighbour_id")
        .eq("notification_id", id),
    ]);

  if (!n) notFound();
  if (n.status !== "draft") redirect(`/blasting/${id}`);

  return (
    <>
      <Link className="link-back" href={`/blasting/${id}`}>
        ← Back
      </Link>
      <div className="page-head">
        <h1>Edit notification</h1>
      </div>
      <div className="card">
        <NotificationForm
          action={updateNotification.bind(null, id)}
          neighbours={neighbours ?? []}
          templates={templates ?? []}
          defaults={n}
          selectedRecipients={(recs ?? [])
            .map((r) => r.neighbour_id)
            .filter((x): x is string => !!x)}
          submitLabel="Save draft"
        />
      </div>
      <p className="hint">
        Changing the neighbour list here rebuilds it from scratch (this is only
        possible while it&apos;s still a draft).
      </p>
    </>
  );
}
