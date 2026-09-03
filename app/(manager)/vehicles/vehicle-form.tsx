"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  Field,
  SelectField,
  TextAreaField,
  FormSection,
} from "@/components/form-fields";
import { ASSET_STATUSES, STATUS_LABELS, FUEL_TYPES } from "@/lib/assets";
import {
  ComplianceDateFields,
  type ComplianceItemLite,
} from "@/components/compliance-date-fields";
import type { FormState } from "./actions";

type Defaults = Record<string, string | number | null | undefined>;

export function VehicleForm({
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
          label="Registration"
          name="registration"
          required
          defaultValue={defaults.registration as string}
        />
        <Field label="Make" name="make" defaultValue={defaults.make as string} />
        <Field
          label="Model"
          name="model"
          defaultValue={defaults.model as string}
        />
        <Field
          label="Type"
          name="vehicle_type"
          placeholder="Tipper, Mixer, Van…"
          defaultValue={defaults.vehicle_type as string}
        />
        <Field
          label="Year"
          name="year"
          type="number"
          inputMode="numeric"
          defaultValue={defaults.year as number}
        />
        <Field label="VIN" name="vin" defaultValue={defaults.vin as string} />
        {full && (
          <>
            <Field
              label="Fleet number"
              name="fleet_number"
              defaultValue={defaults.fleet_number as string}
              hint="Leave blank to use the registration."
            />
            <SelectField
              label="Fuel type"
              name="fuel_type"
              defaultValue={defaults.fuel_type as string}
              options={FUEL_TYPES.map((f) => ({ value: f, label: f }))}
            />
          </>
        )}
      </FormSection>

      <ComplianceDateFields assetType="vehicle" items={compliance} />

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

          <FormSection title="Odometer & service schedule">
            <Field
              label="Current mileage (km)"
              name="current_mileage"
              type="number"
              inputMode="numeric"
              defaultValue={defaults.current_mileage as number}
            />
            <Field
              label="Service interval (km)"
              name="service_interval_km"
              type="number"
              inputMode="numeric"
              defaultValue={defaults.service_interval_km as number}
            />
            <Field
              label="Next service at (km)"
              name="next_service_mileage"
              type="number"
              inputMode="numeric"
              defaultValue={defaults.next_service_mileage as number}
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
