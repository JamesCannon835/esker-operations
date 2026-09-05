export type Neighbour = {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
  active: boolean;
};

export type BlastNotification = {
  id: string;
  title: string | null;
  blast_at: string | null;
  message: string;
  status: "draft" | "sent";
  created_at: string;
  sent_at: string | null;
};

export const RECIPIENT_STATUS_LABELS: Record<string, string> = {
  pending: "Not sent",
  sent: "Sent",
  delivered: "Delivered",
  failed: "Failed",
  skipped: "—",
};

/** Fill {date} / {time} tokens from a blast datetime (en-IE). */
export function fillTemplate(body: string, blastAt: string | null): string {
  if (!blastAt) return body;
  const d = new Date(blastAt);
  if (Number.isNaN(d.getTime())) return body;
  const date = d.toLocaleDateString("en-IE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = d.toLocaleTimeString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return body.replace(/\{date\}/g, date).replace(/\{time\}/g, time);
}

/** GSM-ish segment count so the composer can warn about long messages. */
export function smsSegments(text: string): number {
  const len = text.length;
  if (len === 0) return 0;
  return len <= 160 ? 1 : Math.ceil(len / 153);
}
