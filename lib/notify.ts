import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Operational email notifications (fault reported, inspection completed).
 *
 * Recipients are resolved automatically: every active user who holds the
 * `transport_manager` or `admin` role. Add or remove people on the Users
 * screen and the notification list follows.
 *
 * Needs two Vercel environment variables (Production):
 *   RESEND_API_KEY   — the same key the reminders function uses
 *   NOTIFY_FROM      — e.g. "Esker Operations <ops@yourdomain.ie>"
 * If either is missing the send is skipped silently (nothing breaks).
 */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://esker-operations.vercel.app";

async function recipientsForRoles(roles: string[]): Promise<string[]> {
  const admin = createAdminClient();

  const { data: roleRows } = await admin
    .from("user_roles")
    .select("user_id")
    .in("role", roles);
  const wanted = new Set((roleRows ?? []).map((r) => r.user_id as string));
  if (wanted.size === 0) return [];

  const { data: profiles } = await admin
    .from("users")
    .select("id, active")
    .in("id", [...wanted]);
  const active = new Set(
    (profiles ?? []).filter((u) => u.active).map((u) => u.id as string),
  );
  if (active.size === 0) return [];

  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  return (list?.users ?? [])
    .filter((u) => active.has(u.id) && !!u.email)
    .map((u) => u.email as string);
}

/** Email every active user holding one of `roles`. Best-effort — never throws. */
export async function notifyRoles(
  roles: string[],
  subject: string,
  text: string,
): Promise<void> {
  try {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.NOTIFY_FROM ?? process.env.REMINDER_FROM;
    if (!key || !from) {
      console.warn("notify: RESEND_API_KEY / NOTIFY_FROM not set — skipping");
      return;
    }

    const to = await recipientsForRoles(roles);
    if (to.length === 0) {
      console.warn(`notify: no active recipients for ${roles.join(", ")}`);
      return;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) {
      console.error("notify: resend responded", res.status, await res.text());
    }
  } catch (err) {
    console.error("notify: failed", err);
  }
}

export function emailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY &&
      (process.env.NOTIFY_FROM ?? process.env.REMINDER_FROM),
  );
}

export type EmailResult = { ok: boolean; ref?: string; error?: string };

/** Send one email to explicit recipients. Best-effort; returns a result. */
export async function sendEmail(
  to: string[],
  subject: string,
  text: string,
): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM ?? process.env.REMINDER_FROM;
  if (!key || !from) return { ok: false, error: "Email is not connected" };
  if (to.length === 0) return { ok: false, error: "No email address" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) {
      return { ok: false, error: `Resend ${res.status}` };
    }
    const body = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, ref: body?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send failed" };
  }
}

/** Transport managers + admins. */
export function notifyManagers(subject: string, text: string): Promise<void> {
  return notifyRoles(["transport_manager", "admin"], subject, text);
}

/** Transport managers + admins + mechanics — for anything the workshop acts on. */
export function notifyWorkshop(subject: string, text: string): Promise<void> {
  return notifyRoles(["transport_manager", "admin", "mechanic"], subject, text);
}
