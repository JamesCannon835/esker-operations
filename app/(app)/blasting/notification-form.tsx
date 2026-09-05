"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { fillTemplate, smsSegments } from "@/lib/blasting";
import type { FormState } from "./actions";

type Neighbour = { id: string; name: string; address: string | null };
type Template = { id: string; name: string; body: string };

export function NotificationForm({
  action,
  neighbours,
  templates,
  defaults,
  selectedRecipients,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  neighbours: Neighbour[];
  templates: Template[];
  defaults?: {
    title?: string | null;
    blast_at?: string | null;
    message?: string | null;
  };
  selectedRecipients?: string[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const d = defaults ?? {};

  const [blastAt, setBlastAt] = useState(
    d.blast_at ? toLocalInput(d.blast_at) : "",
  );
  const [message, setMessage] = useState(d.message ?? "");
  const preset = new Set(selectedRecipients ?? neighbours.map((n) => n.id));
  const [picked, setPicked] = useState<Set<string>>(preset);

  const segs = useMemo(() => smsSegments(message), [message]);

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allOn = picked.size === neighbours.length;

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setMessage(
      fillTemplate(t.body, blastAt ? new Date(blastAt).toISOString() : null),
    );
  }

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      <div className="field">
        <label htmlFor="title">Reference (optional)</label>
        <input
          id="title"
          name="title"
          type="text"
          defaultValue={d.title ?? ""}
          placeholder="e.g. North face blast"
        />
      </div>

      <div className="field">
        <label htmlFor="blast_at">Planned blast date &amp; time</label>
        <input
          id="blast_at"
          name="blast_at"
          type="datetime-local"
          value={blastAt}
          onChange={(e) => setBlastAt(e.target.value)}
        />
      </div>

      {templates.length > 0 && (
        <div className="field">
          <label htmlFor="tmpl">Start from a template</label>
          <select
            id="tmpl"
            defaultValue=""
            onChange={(e) => {
              applyTemplate(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">— choose —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <div className="field-hint">
            <code>{"{date}"}</code> and <code>{"{time}"}</code> fill in from the
            blast time above.
          </div>
        </div>
      )}

      <div className="field">
        <label htmlFor="message">
          Message <span className="req">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="field-hint">
          {message.length} characters · {segs} text{segs === 1 ? "" : "s"} per
          neighbour
        </div>
      </div>

      <div className="field">
        <label>
          Send to <span className="req">*</span>
        </label>
        <div style={{ marginBottom: 6 }}>
          <button
            type="button"
            className="btn ghost small"
            onClick={() =>
              setPicked(
                allOn ? new Set() : new Set(neighbours.map((n) => n.id)),
              )
            }
          >
            {allOn ? "Clear all" : "Select everyone"}
          </button>
        </div>
        <div className="tb-recipients">
          {neighbours.map((n) => (
            <label key={n.id} className="tb-recipient">
              <input
                type="checkbox"
                name="recipient"
                value={n.id}
                checked={picked.has(n.id)}
                onChange={() => toggle(n.id)}
              />{" "}
              {n.name}
              {n.address ? ` · ${n.address}` : ""}
            </label>
          ))}
        </div>
        {neighbours.length === 0 && (
          <div className="field-hint">
            No neighbours yet — <Link href="/blasting/neighbours">add some</Link>{" "}
            first.
          </div>
        )}
      </div>

      <div className="btn-row">
        <button className="btn" type="submit">
          {submitLabel}
        </button>
        <Link className="btn ghost" href="/blasting">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
