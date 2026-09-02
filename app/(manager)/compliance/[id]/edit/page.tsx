import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAssetOptions } from "@/lib/asset-picker";
import { resolveAssetLabels } from "@/lib/asset-labels";
import { updateComplianceItem, setComplianceVoided } from "../../actions";
import { ComplianceForm } from "../../compliance-form";
import { ConfirmButton } from "@/components/confirm-button";

export const dynamic = "force-dynamic";

export default async function EditCompliancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("compliance_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!item) notFound();

  const [assets, labels] = await Promise.all([
    getAssetOptions(),
    resolveAssetLabels([item]),
  ]);
  const assetLabel = labels.get(`${item.asset_type}:${item.asset_id}`) ?? "—";

  return (
    <>
      <Link className="link-back" href="/compliance">
        ← Compliance
      </Link>
      <div className="page-head">
        <h1>Edit compliance item</h1>
      </div>

      <div className="card">
        <p className="hint">Asset: {assetLabel}</p>
        <ComplianceForm
          action={updateComplianceItem.bind(null, id)}
          assets={assets}
          lockAsset
          defaults={{
            asset: `${item.asset_type}:${item.asset_id}`,
            compliance_type: item.compliance_type,
            due_date: item.due_date,
            last_completed_date: item.last_completed_date,
            notes: item.notes,
          }}
          submitLabel="Save changes"
        />
      </div>

      <div className="card">
        <h2>Void</h2>
        <p className="hint">
          Compliance records are never deleted. Voiding removes it from the
          dashboard but keeps it for audit.
        </p>
        <ConfirmButton
          action={setComplianceVoided.bind(null, id, true)}
          label="Void this item"
          className="btn danger"
          confirmText="Void this compliance item?"
        />
      </div>
    </>
  );
}
