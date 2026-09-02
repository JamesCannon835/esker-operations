import Link from "next/link";
import { getAssetOptions } from "@/lib/asset-picker";
import { FaultForm } from "../fault-form";

export const dynamic = "force-dynamic";

export default async function NewFaultPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; id?: string }>;
}) {
  const { type, id } = await searchParams;
  const assets = await getAssetOptions();
  const defaultAsset = type && id ? `${type}:${id}` : undefined;

  return (
    <>
      <Link className="link-back" href="/faults">
        ← Faults
      </Link>
      <div className="page-head">
        <h1>Report a fault</h1>
      </div>
      <div className="card">
        <FaultForm
          assets={assets}
          defaultAsset={defaultAsset}
          cancelHref="/faults"
        />
      </div>
    </>
  );
}
