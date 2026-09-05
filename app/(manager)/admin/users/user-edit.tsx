"use client";

import { useActionState, useTransition } from "react";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roles";
import {
  updateProfile,
  resetPassword,
  regenerateAccessCode,
  toggleRole,
  type FormState,
} from "./actions";

export function ProfileForm({
  userId,
  fullName,
  phone,
  email,
}: {
  userId: string;
  fullName: string;
  phone: string | null;
  email: string;
}) {
  const action = updateProfile.bind(null, userId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}
      {state.ok && <p className="ok">{state.ok}</p>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="full_name">Full name</label>
          <input id="full_name" name="full_name" defaultValue={fullName} required />
        </div>
        <div className="field">
          <label htmlFor="email">Sign-in email</label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={email}
            placeholder="name@example.com"
          />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" defaultValue={phone ?? ""} />
        </div>
      </div>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}

export function RoleEditor({
  userId,
  current,
  disabled,
}: {
  userId: string;
  current: Role[];
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
      {ROLES.map((r) => {
        const has = current.includes(r);
        return (
          <label key={r} style={{ display: "flex", gap: 6, fontWeight: 400 }}>
            <input
              type="checkbox"
              checked={has}
              disabled={disabled || pending}
              style={{ width: "auto" }}
              onChange={() => start(() => toggleRole(userId, r, !has))}
            />
            {ROLE_LABELS[r]}
          </label>
        );
      })}
    </div>
  );
}

export function AccessCodeForm({ userId }: { userId: string }) {
  const action = regenerateAccessCode.bind(null, userId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}
      {state.ok && (
        <p className="ok" style={{ fontSize: 16 }}>
          {state.ok}
        </p>
      )}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Generating…" : "Generate a new access code"}
      </button>
    </form>
  );
}

export function PasswordForm({ userId }: { userId: string }) {
  const action = resetPassword.bind(null, userId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  return (
    <form action={formAction} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {state.error && <div className="error" style={{ flexBasis: "100%" }}>{state.error}</div>}
      {state.ok && <p className="ok" style={{ flexBasis: "100%" }}>{state.ok}</p>}
      <input
        name="password"
        placeholder="New password (min 8)"
        minLength={8}
        required
        style={{
          padding: "9px 11px",
          border: "1px solid var(--border)",
          borderRadius: 8,
          fontSize: 14,
        }}
      />
      <button className="btn ghost" type="submit" disabled={pending}>
        {pending ? "Setting…" : "Set password"}
      </button>
    </form>
  );
}
