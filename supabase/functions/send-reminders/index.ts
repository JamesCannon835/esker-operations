// Supabase Edge Function — daily compliance & document-expiry reminders.
//
// Deploy:   supabase functions deploy send-reminders --no-verify-jwt
// Secrets:  supabase secrets set RESEND_API_KEY=...  REMINDER_FROM="Esker Ops <ops@yourdomain.ie>"  REMINDER_TO="a@x.ie,b@x.ie"
// Schedule: in the dashboard (Edge Functions -> send-reminders -> Schedules)
//           or with pg_cron — see supabase/phase6_reminders_cron.sql
//
// It reports anything due within the next 14 days or already overdue.

import { createClient } from "jsr:@supabase/supabase-js@2";

const WINDOW_DAYS = 14;

const TYPE_LABELS: Record<string, string> = {
  tax: "Motor tax",
  cvrt_test: "CVRT test",
  insurance: "Insurance",
  thirteen_week_inspection: "13-week inspection",
  tacho_calibration: "Tachograph calibration",
  service: "Service",
  other: "Other",
};

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const today = new Date();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + WINDOW_DAYS);
  const horizonStr = horizon.toISOString().slice(0, 10);

  const [{ data: compliance }, { data: docs }, { data: vehicles }, { data: plant }, { data: trailers }] =
    await Promise.all([
      supabase
        .from("compliance_items")
        .select("asset_type, asset_id, compliance_type, due_date")
        .eq("voided", false)
        .lte("due_date", horizonStr)
        .order("due_date"),
      supabase
        .from("documents")
        .select("asset_type, asset_id, category, expiry_date")
        .eq("voided", false)
        .not("expiry_date", "is", null)
        .lte("expiry_date", horizonStr)
        .order("expiry_date"),
      supabase.from("vehicles").select("id, fleet_number, registration"),
      supabase.from("plant").select("id, asset_number, plant_type"),
      supabase.from("trailers").select("id, registration"),
    ]);

  const label = (t: string, id: string) => {
    if (t === "vehicle") {
      const v = vehicles?.find((x) => x.id === id);
      return v ? `${v.fleet_number} · ${v.registration}` : "vehicle";
    }
    if (t === "plant") {
      const p = plant?.find((x) => x.id === id);
      return p ? `${p.asset_number}${p.plant_type ? ` · ${p.plant_type}` : ""}` : "plant";
    }
    const tr = trailers?.find((x) => x.id === id);
    return tr ? tr.registration : "trailer";
  };

  const days = (d: string) =>
    Math.round(
      (new Date(d).getTime() - new Date(today.toISOString().slice(0, 10)).getTime()) /
        86_400_000,
    );
  const when = (d: string) => {
    const n = days(d);
    return n < 0 ? `${Math.abs(n)}d overdue` : n === 0 ? "due today" : `in ${n}d`;
  };

  const lines: string[] = [];
  for (const c of compliance ?? []) {
    lines.push(
      `• ${label(c.asset_type, c.asset_id)} — ${TYPE_LABELS[c.compliance_type] ?? c.compliance_type} — ${c.due_date} (${when(c.due_date)})`,
    );
  }
  for (const d of docs ?? []) {
    lines.push(
      `• ${label(d.asset_type, d.asset_id)} — document "${d.category}" expires ${d.expiry_date} (${when(d.expiry_date)})`,
    );
  }

  if (lines.length === 0) {
    return new Response(JSON.stringify({ sent: false, reason: "nothing due" }), {
      headers: { "content-type": "application/json" },
    });
  }

  const body =
    `Esker Operations — compliance due in the next ${WINDOW_DAYS} days (or overdue):\n\n` +
    lines.join("\n") +
    `\n\nOpen the compliance dashboard: https://esker-operations.vercel.app/compliance\n`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: Deno.env.get("REMINDER_FROM"),
      to: (Deno.env.get("REMINDER_TO") ?? "").split(",").map((s) => s.trim()),
      subject: `Esker Operations — ${lines.length} compliance item(s) need attention`,
      text: body,
    }),
  });

  return new Response(
    JSON.stringify({ sent: res.ok, count: lines.length, status: res.status }),
    { headers: { "content-type": "application/json" } },
  );
});
