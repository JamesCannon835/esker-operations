import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NotificationForm } from "../notification-form";
import { createNotification } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewNotificationPage() {
  await requireManager();
  const supabase = await createClient();

  const [{ data: neighbours }, { data: templates }] = await Promise.all([
    supabase
      .from("neighbours")
      .select("id, name, address")
      .eq("active", true)
      .order("name"),
    supabase.from("sms_templates").select("id, name, body").order("name"),
  ]);

  return (
    <>
      <Link className="link-back" href="/blasting">
        ← Blast notifications
      </Link>
      <div className="page-head">
        <h1>New blast notification</h1>
      </div>
      <div className="card">
        <NotificationForm
          action={createNotification}
          neighbours={neighbours ?? []}
          templates={templates ?? []}
          submitLabel="Save draft"
        />
      </div>
      <p className="hint">
        Saves as a draft so you can check it. Sending happens from the next
        screen.
      </p>
    </>
  );
}
