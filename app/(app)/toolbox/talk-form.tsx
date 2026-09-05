"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { FormState } from "./actions";

type PersonOption = { id: string; full_name: string };
type DocOption = { id: string; label: string };

export function TalkForm({
  action,
  people,
  documents,
  defaults,
  selectedRecipients,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  people: PersonOption[];
  documents: DocOption[];
  defaults?: {
    title?: string;
    talk_date?: string;
    body?: string | null;
    document_id?: string | null;
  };
  selectedRecipients?: string[];
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const d = defaults ?? {};
  const preset = new Set(selectedRecipients ?? people.map((p) => p.id));
  const [picked, setPicked] = useState<Set<string>>(preset);

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allOn = picked.size === people.length;

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      <div className="field">
        <label htmlFor="title">
          Title <span className="req">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={d.title ?? ""}
          placeholder="e.g. Working near reversing vehicles"
        />
      </div>

      <div className="field">
        <label htmlFor="talk_date">
          Date / week <span className="req">*</span>
        </label>
        <input
          id="talk_date"
          name="talk_date"
          type="date"
          required
          defaultValue={d.talk_date ?? new Date().toISOString().slice(0, 10)}
        />
      </div>

      <div className="field">
        <label htmlFor="document_id">Attach a document (from the library)</label>
        <select
          id="document_id"
          name="document_id"
          defaultValue={d.document_id ?? ""}
        >
          <option value="">— none —</option>
          {documents.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.label}
            </option>
          ))}
        </select>
        <div className="field-hint">
          Upload the PDF to Documents → Health &amp; Safety → Toolbox first, then
          pick it here. Or just type the talk below.
        </div>
      </div>

      <div className="field">
        <label htmlFor="body">Talk text</label>
        <textarea id="body" name="body" rows={6} defaultValue={d.body ?? ""} />
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
              setPicked(allOn ? new Set() : new Set(people.map((p) => p.id)))
            }
          >
            {allOn ? "Clear all" : "Select everyone"}
          </button>
        </div>
        <div className="tb-recipients">
          {people.map((p) => (
            <label key={p.id} className="tb-recipient">
              <input
                type="checkbox"
                name="recipient"
                value={p.id}
                checked={picked.has(p.id)}
                onChange={() => toggle(p.id)}
              />{" "}
              {p.full_name}
            </label>
          ))}
        </div>
      </div>

      <div className="btn-row">
        <button className="btn" type="submit">
          {submitLabel}
        </button>
        <Link className="btn ghost" href="/toolbox">
          Cancel
        </Link>
      </div>
    </form>
  );
}
