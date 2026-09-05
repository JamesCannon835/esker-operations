"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { MicTextarea } from "@/components/mic-textarea";
import { TaskPhotos } from "./task-photos";
import { createTask, type FormState } from "./actions";

type Person = { id: string; full_name: string };

export function TaskForm({ people }: { people: Person[] }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    createTask,
    {},
  );
  const [tempId] = useState(() => crypto.randomUUID());

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      <div className="field">
        <label htmlFor="title">
          What needs doing? <span className="req">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder="e.g. Clean out the wash bay"
        />
      </div>

      <div className="field">
        <label htmlFor="detail">More detail (optional — you can talk it in)</label>
        <MicTextarea
          id="detail"
          name="detail"
          rows={3}
          placeholder="Any extra notes…"
        />
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="assigned_to">Give it to</label>
          <select id="assigned_to" name="assigned_to" defaultValue="">
            <option value="">— nobody yet —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="due_date">Due (optional)</label>
          <input id="due_date" name="due_date" type="date" />
        </div>
        <div className="field">
          <label htmlFor="priority">Priority</label>
          <select id="priority" name="priority" defaultValue="normal">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="critical">Urgent</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label>Photos (optional)</label>
        <TaskPhotos actionId={tempId} />
      </div>

      <div className="btn-row">
        <button className="btn" type="submit">
          Create task
        </button>
        <Link className="btn ghost" href="/actions">
          Cancel
        </Link>
      </div>
    </form>
  );
}
