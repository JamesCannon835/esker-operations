"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ROLES, ROLE_LABELS } from "@/lib/roles";
import { createUser, type FormState } from "./actions";

export function NewUserForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createUser,
    {},
  );

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="full_name">
            Full name <span className="req">*</span>
          </label>
          <input id="full_name" name="full_name" required />
        </div>
        <div className="field">
          <label htmlFor="email">
            Email <span className="req">*</span>
          </label>
          <input id="email" name="email" type="email" required />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" />
        </div>
        <div className="field">
          <label htmlFor="password">
            Starting password <span className="req">*</span>
          </label>
          <input id="password" name="password" minLength={8} required />
          <div className="field-hint">
            At least 8 characters. Tell the person — they can change it later.
          </div>
        </div>
      </div>

      <div className="field">
        <label>Roles</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {ROLES.map((r) => (
            <label
              key={r}
              style={{ display: "flex", gap: 6, fontWeight: 400 }}
            >
              <input
                type="checkbox"
                name={`role_${r}`}
                style={{ width: "auto" }}
              />
              {ROLE_LABELS[r]}
            </label>
          ))}
        </div>
      </div>

      <div className="btn-row">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create person"}
        </button>
        <Link className="btn ghost" href="/admin/users">
          Cancel
        </Link>
      </div>
    </form>
  );
}
