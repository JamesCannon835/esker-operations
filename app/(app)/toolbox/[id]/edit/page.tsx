import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toolboxDocumentOptions } from "@/lib/toolbox-server";
import { TalkForm } from "../../talk-form";
import { updateTalk } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditTalkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireManager();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: talk }, { data: people }, documents, { data: recips }] =
    await Promise.all([
      supabase
        .from("toolbox_talks")
        .select("id, title, talk_date, body, document_id, status")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("users")
        .select("id, full_name, active")
        .eq("active", true)
        .order("full_name"),
      toolboxDocumentOptions(),
      supabase
        .from("toolbox_talk_recipients")
        .select("user_id")
        .eq("talk_id", id),
    ]);

  if (!talk) notFound();
  if (talk.status !== "draft") redirect(`/toolbox/${id}`);

  return (
    <>
      <Link className="link-back" href={`/toolbox/${id}`}>
        ← Back
      </Link>
      <div className="page-head">
        <h1>Edit toolbox talk</h1>
      </div>
      <div className="card">
        <TalkForm
          action={updateTalk.bind(null, id)}
          people={(people ?? []).map((p) => ({
            id: p.id,
            full_name: p.full_name,
          }))}
          documents={documents}
          defaults={talk}
          selectedRecipients={(recips ?? []).map((r) => r.user_id)}
          submitLabel="Save draft"
        />
      </div>
    </>
  );
}
