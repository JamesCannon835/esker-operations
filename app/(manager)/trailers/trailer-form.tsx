"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  Field,
  SelectField,
  TextAreaField,
  FormSection,
} from "@/components/form-fields";
import type { FormState } from "./actions";

type Defaults = Record<string, string | number | null | undefined>;

export function TrailerForm({
  action,
  vehicles,
  defaults = {},
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  vehicles: { id: string; label: string }[];
  defaults?: Defaults;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      <FormSection title="Identity">
        <Field
          label="Registration"
          name="registration"
          required
          defaultValue={defaults.registration as string}
        />
        <Field
          label="Trailer type"
          name="trailer_type"
          placeholder="Flatbed, Tipping, Low-loader…"
          defaultValue={defaults.trailer_type as string}
        />
        <Field label="Make" name="make" defaultValue={defaults.make as string} />
        <Field
          label="Model"
          name="model"
          defaultValue={defaults.model as string}
        />
        <Field
          label="Year"
          name="year"
          type="number"
          inputMode="numeric"
          defaultValue={defaults.year as number}
        />
        <Field label="VIN" name="vin" defaultValue={defaults.vin as string} />
      </FormSection>

      <FormSection title="Assignment">
        <SelectField
          label="Assigned to vehicle"
          name="assigned_vehicle_id"
          defaultValue={defaults.assigned_vehicle_id as string}
          placeholder="— Unassigned —"
          options={vehicles.map((v) => ({ value: v.id, label: v.label }))}
        />
      </FormSection>

      <FormSection title="Notes" single>
        <TextAreaField
          label="Notes"
          name="notes"
          defaultValue={defaults.notes as string}
        />
      </FormSection>

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
