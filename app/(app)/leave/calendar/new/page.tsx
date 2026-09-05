import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { vehicleName } from "@/lib/asset-name";
import { EventForm } from "../event-form";
import { createEvent } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  await requireManager();
  const supabase = await createClient();
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, fleet_number, registration")
    .eq("voided", false)
    .order("registration");

  return (
    <>
      <Link className="link-back" href="/leave/calendar">
        ← Company calendar
      </Link>
      <div className="page-head">
        <h1>New calendar entry</h1>
      </div>
      <div className="card">
        <EventForm
          action={createEvent}
          submitLabel="Add to calendar"
          vehicles={(vehicles ?? []).map((v) => ({
            id: v.id,
            label: vehicleName(v.fleet_number, v.registration),
          }))}
        />
      </div>
    </>
  );
}
