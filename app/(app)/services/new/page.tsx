import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";
import { getAssetOptions } from "@/lib/asset-picker";
import { ServiceForm } from "../service-form";

export const dynamic = "force-dynamic";

export default async function NewServicePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; id?: string }>;
}) {
  const { roles } = await requireUser();
  if (!isManager(roles) && !hasRole(roles, "mechanic")) redirect("/services");

  const { type, id } = await searchParams;
  const assets = await getAssetOptions();
  const defaultAsset = type && id ? `${type}:${id}` : undefined;

  return (
    <>
      <Link className="link-back" href="/services">
        ← Services
      </Link>
      <div className="page-head">
        <h1>Log a service</h1>
      </div>
      <div className="card">
        <ServiceForm assets={assets} defaultAsset={defaultAsset} />
      </div>
    </>
  );
}
