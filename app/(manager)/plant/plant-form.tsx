"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  Field,
  SelectField,
  TextAreaField,
  FormSection,
} from "@/components/form-fields";
import { ASSET_STATUSES, STATUS_LABELS } from "@/lib/assets";
import {
  ComplianceDateFields,
  type ComplianceItemLite,
} from "@/components/compliance-date-fields";
import type { FormState } from "./actions";

type Defaults = Record<string, string | number | null | undefined>;

export function PlantForm({
  action,
  defaults = {},
  compliance = [],
  submitLabel,
  cancelHref,
  mode = "edit",
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  defaults?: Defaults;
  compliance?: ComplianceItemLite[];
  submitLabel: string;
  cancelHref: string;
  mode?: "create" | "edit";
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const full = mode === "edit";

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      <FormSection title="Details">
        <Field
          label="Asset number"
          name="asset_number"
          required
          defaultValue={defaults.asset_number as string}
        />
        <Field
          label="Type"
          name="plant_type"
          placeholder="Excavator, Wheel Loader, Dumper…"
          defaultValue={defaults.plant_type as string}
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
        <Field
          label="Serial number"
          name="serial_number"
          defaultValue={defaults.serial_number as string}
        />
      </FormSection>

      <ComplianceDateFields assetType="plant" items={compliance} />

      {full && (
        <>
          <FormSection title="Status">
            <SelectField
              label="Status"
              name="status"
              required
              defaultValue={(defaults.status as string) ?? "available"}
              options={ASSET_STATUSES.map((s) => ({
                value: s,
                label: STATUS_LABELS[s],
              }))}
            />
          </FormSection>

          <FormSection title="Hours & service schedule">
            <Field
              label="Current hours"
              name="current_hours"
              type="number"
              inputMode="numeric"
              defaultValue={defaults.current_hours as number}
            />
            <Field
              label="Service interval (hours)"
              name="service_interval_hours"
              type="number"
              inputMode="numeric"
              defaultValue={defaults.service_interval_hours as number}
            />
            <Field
              label="Next service at (hours)"
              name="next_service_hours"
              type="number"
              inputMode="numeric"
              defaultValue={defaults.next_service_hours as number}
            />
            <Field
              label="Next service date"
              name="next_service_date"
              type="date"
              defaultValue={defaults.next_service_date as string}
            />
          </FormSection>

          <FormSection title="Notes" single>
            <TextAreaField
              label="Notes"
              name="notes"
              defaultValue={defaults.notes as string}
            />
          </FormSection>
        </>
      )}

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
