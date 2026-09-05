import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toolboxDocumentOptions } from "@/lib/toolbox-server";
import { TalkForm } from "../talk-form";
import { createTalk } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewTalkPage() {
  await requireManager();
  const supabase = await createClient();

  const [{ data: people }, documents] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, active")
      .eq("active", true)
      .order("full_name"),
    toolboxDocumentOptions(),
  ]);

  return (
    <>
      <Link className="link-back" href="/toolbox">
        ← Toolbox talks
      </Link>
      <div className="page-head">
        <h1>New toolbox talk</h1>
      </div>
      <div className="card">
        <TalkForm
          action={createTalk}
          people={(people ?? []).map((p) => ({
            id: p.id,
            full_name: p.full_name,
          }))}
          documents={documents}
          submitLabel="Create (draft)"
        />
      </div>
      <p className="hint">
        Creates a draft. You review it, then hit <strong>Send</strong> on the
        next screen to release it to everyone.
      </p>
    </>
  );
}
