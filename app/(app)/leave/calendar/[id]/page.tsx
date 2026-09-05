import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { vehicleName } from "@/lib/asset-name";
import type { CalendarEvent } from "@/lib/calendar";
import { ConfirmButton } from "@/components/confirm-button";
import { EventForm } from "../event-form";
import { updateEvent, deleteEvent } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireManager();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: event }, { data: vehicles }] = await Promise.all([
    supabase
      .from("calendar_events")
      .select(
        "id, title, category, start_date, end_date, note, asset_type, asset_id",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("vehicles")
      .select("id, fleet_number, registration")
      .eq("voided", false)
      .order("registration"),
  ]);

  if (!event) notFound();

  return (
    <>
      <Link className="link-back" href="/leave/calendar">
        ← Company calendar
      </Link>
      <div className="page-head">
        <h1>Edit calendar entry</h1>
        <ConfirmButton
          action={deleteEvent.bind(null, event.id)}
          label="Delete"
          className="btn ghost small"
          confirmText="Delete this calendar entry?"
        />
      </div>
      <div className="card">
        <EventForm
          action={updateEvent.bind(null, event.id)}
          submitLabel="Save changes"
          defaults={event as CalendarEvent}
          vehicles={(vehicles ?? []).map((v) => ({
            id: v.id,
            label: vehicleName(v.fleet_number, v.registration),
          }))}
        />
      </div>
    </>
  );
}
