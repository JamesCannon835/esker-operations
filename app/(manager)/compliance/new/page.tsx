import Link from "next/link";
import { getAssetOptions } from "@/lib/asset-picker";
import { createComplianceItem } from "../actions";
import { ComplianceForm } from "../compliance-form";

export const dynamic = "force-dynamic";

export default async function NewCompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; id?: string }>;
}) {
  const { type, id } = await searchParams;
  const assets = await getAssetOptions();
  const defaultAsset = type && id ? `${type}:${id}` : undefined;

  return (
    <>
      <Link className="link-back" href="/compliance">
        ← Compliance
      </Link>
      <div className="page-head">
        <h1>Add compliance item</h1>
      </div>
      <div className="card">
        <ComplianceForm
          action={createComplianceItem}
          assets={assets}
          defaults={{ asset: defaultAsset }}
          submitLabel="Add item"
        />
      </div>
    </>
  );
}
