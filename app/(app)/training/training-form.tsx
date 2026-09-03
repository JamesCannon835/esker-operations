"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  TRAINING_BUCKET,
  TRAINING_PREFIX,
  MAX_CERT_BYTES,
  ACCEPTED_CERT_TYPES,
  type TrainingCourse,
} from "@/lib/training";
import type { FormState } from "./actions";

type PersonOption = { id: string; full_name: string };

function sanitize(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80) || "certificate";
}

export function TrainingForm({
  action,
  courses,
  people,
  defaults = {},
  lockedPerson,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  courses: TrainingCourse[];
  people: PersonOption[];
  defaults?: {
    user_id?: string;
    course_name?: string;
    completed_date?: string | null;
    expiry_date?: string | null;
    notes?: string | null;
    certificate_name?: string | null;
  };
  /** When set, the person is fixed (add-from-person-page, or edit). */
  lockedPerson?: PersonOption;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const knownCourse = courses.some((c) => c.name === defaults.course_name);
  const [course, setCourse] = useState(
    defaults.course_name && knownCourse
      ? defaults.course_name
      : defaults.course_name
        ? "__other__"
        : "",
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    const form = formRef.current!;
    const fileInput = form.elements.namedItem("cert") as HTMLInputElement;
    const file = fileInput?.files?.[0];

    const fd = new FormData(form);
    fd.delete("cert");

    if (file) {
      if (file.size > MAX_CERT_BYTES) {
        setLocalError("That file is over the 15 MB limit.");
        return;
      }
      setBusy(true);
      const supabase = createClient();
      const path = `${TRAINING_PREFIX}/${crypto.randomUUID()}/${sanitize(file.name)}`;
      const { error } = await supabase.storage
        .from(TRAINING_BUCKET)
        .upload(path, file, { contentType: file.type || undefined });
      if (error) {
        setBusy(false);
        setLocalError(`Certificate upload failed: ${error.message}`);
        return;
      }
      fd.set("certificate_path", path);
      fd.set("certificate_name", file.name);
    }

    formAction(fd);
    setBusy(false);
  }

  const error = localError ?? state.error;
  const personId = lockedPerson?.id ?? defaults.user_id;

  return (
    <form ref={formRef} onSubmit={onSubmit}>
      {error && <div className="error">{error}</div>}

      <div className="field">
        <label htmlFor="user_id">
          Person <span className="req">*</span>
        </label>
        {lockedPerson ? (
          <>
            <input type="hidden" name="user_id" value={lockedPerson.id} />
            <input type="text" value={lockedPerson.full_name} disabled />
          </>
        ) : (
          <select
            id="user_id"
            name="user_id"
            required
            defaultValue={personId ?? ""}
          >
            <option value="">— Choose person —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="field">
        <label htmlFor="course_name">
          Course <span className="req">*</span>
        </label>
        <select
          id="course_name"
          name="course_name"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        >
          <option value="">— Choose course —</option>
          {courses.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
          <option value="__other__">Other (type below)…</option>
        </select>
      </div>

      {course === "__other__" && (
        <div className="field">
          <label htmlFor="new_course">New course name</label>
          <input
            id="new_course"
            name="new_course"
            defaultValue={knownCourse ? "" : (defaults.course_name ?? "")}
            placeholder="e.g. Slew Crane"
          />
        </div>
      )}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="completed_date">
            Date completed <span className="req">*</span>
          </label>
          <input
            id="completed_date"
            name="completed_date"
            type="date"
            required
            defaultValue={defaults.completed_date ?? undefined}
          />
        </div>
        <div className="field">
          <label htmlFor="expiry_date">Expiry date</label>
          <input
            id="expiry_date"
            name="expiry_date"
            type="date"
            defaultValue={defaults.expiry_date ?? undefined}
          />
          <div className="field-hint">Leave blank if it doesn&apos;t expire.</div>
        </div>
      </div>

      <div className="field">
        <label htmlFor="cert">Certificate</label>
        <input id="cert" name="cert" type="file" accept={ACCEPTED_CERT_TYPES} />
        <div className="field-hint">
          PDF or photo, up to 15 MB.
          {defaults.certificate_name
            ? ` Current: ${defaults.certificate_name} — choose a file only to replace it.`
            : ""}
        </div>
      </div>

      <div className="field">
        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={defaults.notes ?? undefined}
        />
      </div>

      <input type="hidden" name="certificate_path" />

      <div className="btn-row">
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
        <Link className="btn ghost" href={cancelHref}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
