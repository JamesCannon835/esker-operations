"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, SelectField } from "@/components/form-fields";
import { ASSET_TYPES, ASSET_TYPE_LABELS } from "@/lib/inspections";
import type { FormState } from "./actions";

type Defaults = { name?: string; asset_type?: string; category?: string | null };

export function TemplateForm({
  action,
  defaults = {},
  submitLabel,
  cancelHref,
  lockAssetType = false,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  defaults?: Defaults;
  submitLabel: string;
  cancelHref: string;
  lockAssetType?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      <div className="form-grid">
        <Field
          label="Checklist name"
          name="name"
          required
          defaultValue={defaults.name}
          placeholder="Vehicle Daily Check"
        />
        <SelectField
          label="Asset type"
          name="asset_type"
          required
          defaultValue={defaults.asset_type}
          options={ASSET_TYPES.map((t) => ({
            value: t,
            label: ASSET_TYPE_LABELS[t],
          }))}
          hint={
            lockAssetType
              ? "Changing this affects which assets use the checklist."
              : undefined
          }
        />
        <Field
          label="Category / note"
          name="category"
          defaultValue={defaults.category ?? undefined}
          placeholder="Driver walkaround"
        />
      </div>

      <div className="btn-row">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link className="btn ghost" href={cancelHref}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
