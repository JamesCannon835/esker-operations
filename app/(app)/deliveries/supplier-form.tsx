"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "./actions";

export function SupplierForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  defaults?: {
    name?: string;
    account_ref?: string | null;
    contact?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    active?: boolean;
  };
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const d = defaults ?? { active: true };

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      <div className="field">
        <label htmlFor="name">
          Supplier name <span className="req">*</span>
        </label>
        <input id="name" name="name" required defaultValue={d.name ?? ""} />
      </div>

      <div className="del-grid">
        <label>
          Our account no.
          <input name="account_ref" defaultValue={d.account_ref ?? ""} />
        </label>
        <label>
          Contact name
          <input name="contact" defaultValue={d.contact ?? ""} />
        </label>
        <label>
          Phone
          <input name="phone" type="tel" defaultValue={d.phone ?? ""} />
        </label>
        <label>
          Email
          <input name="email" type="email" defaultValue={d.email ?? ""} />
        </label>
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={2} defaultValue={d.notes ?? ""} />
      </div>

      <div className="field">
        <label className="tb-confirm">
          <input type="checkbox" name="active" defaultChecked={d.active ?? true} />{" "}
          Active supplier
        </label>
      </div>

      <div className="btn-row">
        <button className="btn" type="submit">
          {submitLabel}
        </button>
        <Link className="btn ghost" href="/deliveries/suppliers">
          Cancel
        </Link>
      </div>
    </form>
  );
}
