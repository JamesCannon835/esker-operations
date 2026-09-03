import { createClient } from "@/lib/supabase/server";
import { orNull } from "@/lib/assets";
import { COMPLIANCE_COLUMNS } from "@/lib/compliance";

/**
 * Applies the compliance date fields (c_<type> / cid_<type>) from an asset
 * form to the compliance_items table: set a date -> create or update the row,
 * clear a date -> void the row. Best-effort; errors are ignored so a bad
 * date doesn't block the asset save itself.
 */
export async function syncComplianceDates(
  assetType: "vehicle" | "plant" | "trailer",
  assetId: string,
  formData: FormData,
) {
  const supabase = await createClient();

  for (const type of COMPLIANCE_COLUMNS[assetType]) {
    const due = orNull(formData.get(`c_${type}`));
    const cid = orNull(formData.get(`cid_${type}`));

    if (due && cid) {
      await supabase
        .from("compliance_items")
        .update({ due_date: due, voided: false, updated_at: new Date().toISOString() })
        .eq("id", cid);
    } else if (due && !cid) {
      await supabase.from("compliance_items").insert({
        asset_type: assetType,
        asset_id: assetId,
        compliance_type: type,
        due_date: due,
      });
    } else if (!due && cid) {
      await supabase
        .from("compliance_items")
        .update({ voided: true, updated_at: new Date().toISOString() })
        .eq("id", cid);
    }
  }
}
