import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";
import { getAssetOptions } from "@/lib/asset-picker";
import { COMPLIANCE_TYPES } from "@/lib/compliance";
import { createComplianceItem } from "../actions";
import { ComplianceForm } from "../compliance-form";

export const dynamic = "force-dynamic";

export default async function NewCompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; id?: string; ct?: string }>;
}) {
  const { roles } = await requireUser();
  if (!isManager(roles) && !hasRole(roles, "mechanic")) redirect("/compliance");

  const { type, id, ct } = await searchParams;
  const assets = await getAssetOptions();
  const defaultAsset = type && id ? `${type}:${id}` : undefined;
  const defaultType =
    ct && (COMPLIANCE_TYPES as readonly string[]).includes(ct) ? ct : undefined;

  return (
    <>
      <Link className="link-back" href="/compliance">
        ← Compliance
      </Link>
      <div className="page-head">
        <h1>Add compliance date</h1>
      </div>
      <div className="card">
        <ComplianceForm
          action={createComplianceItem}
          assets={assets}
          defaults={{ asset: defaultAsset, compliance_type: defaultType }}
          submitLabel="Add"
        />
      </div>
    </>
  );
}
