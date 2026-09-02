"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "./actions";

type Item = { id: string; item_name: string };

export function DailyCheckForm({
  action,
  items,
  readingLabel,
  cancelHref,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  items: Item[];
  readingLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      <div className="card">
        <h2>Checks</h2>
        <p className="hint">
          Everything starts as Pass. Mark anything wrong as Fail (add a note) —
          each Fail raises a fault automatically.
        </p>
        {items.map((item) => (
          <div className="check-item" key={item.id}>
            <div className="name">{item.item_name}</div>
            <div className="choices">
              <label className="pass">
                <input
                  type="radio"
                  name={`item_${item.id}`}
                  value="pass"
                  defaultChecked
                />
                Pass
              </label>
              <label className="fail">
                <input type="radio" name={`item_${item.id}`} value="fail" />
                Fail
              </label>
              <label className="na">
                <input type="radio" name={`item_${item.id}`} value="na" />
                N/A
              </label>
            </div>
            <input
              className="comment"
              name={`comment_${item.id}`}
              placeholder="Note (required for a fail)"
            />
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Reading &amp; declaration</h2>
        <div className="field">
          <label htmlFor="reading">{readingLabel}</label>
          <input id="reading" name="reading" type="number" inputMode="numeric" />
        </div>

        <div className="field">
          <label>Is the asset safe to operate?</label>
          <div className="choices" style={{ maxWidth: 280 }}>
            <label className="pass">
              <input
                type="radio"
                name="safe_to_operate"
                value="yes"
                defaultChecked
              />
              Yes
            </label>
            <label className="fail">
              <input type="radio" name="safe_to_operate" value="no" />
              No
            </label>
          </div>
        </div>

        <div className="field">
          <label style={{ fontWeight: 400, display: "flex", gap: 8 }}>
            <input type="checkbox" name="signature" style={{ width: "auto" }} />
            <span>
              I confirm I have carried out this check and the information above is
              correct.
            </span>
          </label>
        </div>

        <div className="btn-row">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Submitting…" : "Submit check"}
          </button>
          <Link className="btn ghost" href={cancelHref}>
            Cancel
          </Link>
        </div>
      </div>
    </form>
  );
}
