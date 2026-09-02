import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";
import { getAssetOptions } from "@/lib/asset-picker";
import { UploadForm } from "../upload-form";

export const dynamic = "force-dynamic";

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; id?: string }>;
}) {
  const { roles } = await requireUser();
  if (!isManager(roles) && !hasRole(roles, "mechanic")) redirect("/documents");

  const { type, id } = await searchParams;
  const assets = await getAssetOptions();
  const defaultAsset = type && id ? `${type}:${id}` : undefined;

  return (
    <>
      <Link className="link-back" href="/documents">
        ← Documents
      </Link>
      <div className="page-head">
        <h1>Upload document</h1>
      </div>
      <div className="card">
        <UploadForm assets={assets} defaultAsset={defaultAsset} />
      </div>
    </>
  );
}
