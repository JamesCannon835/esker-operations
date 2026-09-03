import { Field, FormSection } from "@/components/form-fields";
import {
  COMPLIANCE_COLUMNS,
  COMPLIANCE_TYPE_LABELS,
  type ComplianceType,
} from "@/lib/compliance";

export type ComplianceItemLite = {
  id: string;
  compliance_type: string;
  due_date: string;
};

/**
 * Date-per-type compliance section for the vehicle / plant / trailer forms.
 * Renders a hidden cid_<type> alongside each date so the save action knows
 * whether to update an existing row or create one; clearing a date voids it.
 */
export function ComplianceDateFields({
  assetType,
  items = [],
}: {
  assetType: "vehicle" | "plant" | "trailer";
  items?: ComplianceItemLite[];
}) {
  const byType = new Map(items.map((i) => [i.compliance_type, i]));

  return (
    <FormSection title="Compliance dates">
      {COMPLIANCE_COLUMNS[assetType].map((t: ComplianceType) => {
        const existing = byType.get(t);
        return (
          <div key={t}>
            <Field
              label={`${COMPLIANCE_TYPE_LABELS[t]} due`}
              name={`c_${t}`}
              type="date"
              defaultValue={existing?.due_date ?? undefined}
            />
            <input type="hidden" name={`cid_${t}`} value={existing?.id ?? ""} />
          </div>
        );
      })}
    </FormSection>
  );
}
