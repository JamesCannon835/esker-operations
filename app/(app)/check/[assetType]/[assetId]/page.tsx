import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ASSET_TYPE_LABELS,
  readingLabel,
  dailyInspectionType,
  pickDailyTemplate,
  type AssetTypeT,
} from "@/lib/inspections";
import { submitInspection } from "@/app/(app)/inspections/actions";
import { InspectionForm } from "@/components/inspection-form";

export const dynamic = "force-dynamic";

export default async function DailyCheckPage({
  params,
}: {
  params: Promise<{ assetType: string; assetId: string }>;
}) {
  const { assetType, assetId } = await params;
  if (assetType !== "vehicle" && assetType !== "plant") notFound();
  const type = assetType as AssetTypeT;

  const supabase = await createClient();

  const table = type === "plant" ? "plant" : "vehicles";
  const { data: asset } = await supabase
    .from(table)
    .select("*")
    .eq("id", assetId)
    .maybeSingle();

  if (!asset) notFound();

  const label =
    type === "plant"
      ? `${asset.asset_number}${asset.plant_type ? ` · ${asset.plant_type}` : ""}`
      : `${asset.fleet_number} · ${asset.registration}`;

  const { data: templates } = await supabase
    .from("inspection_templates")
    .select("id, name")
    .eq("asset_type", type)
    .order("name");

  const template = pickDailyTemplate(templates ?? []);

  let items: { id: string; item_name: string }[] = [];
  if (template) {
    const { data } = await supabase
      .from("inspection_template_items")
      .select("id, item_name, sort_order")
      .eq("template_id", template.id)
      .order("sort_order");
    items = data ?? [];
  }

  return (
    <>
      <Link className="link-back" href="/check">
        ← Daily check
      </Link>
      <div className="page-head">
        <h1>Daily check — {label}</h1>
        <span className="badge">{ASSET_TYPE_LABELS[type]}</span>
      </div>

      {!template || items.length === 0 ? (
        <div className="card">
          <p className="empty">
            No {ASSET_TYPE_LABELS[type].toLowerCase()} checklist is set up yet. A
            manager needs to create one under{" "}
            <Link href="/checklists">Checklists</Link>.
          </p>
        </div>
      ) : (
        <InspectionForm
          action={submitInspection.bind(null, {
            assetType: type,
            assetId,
            templateId: template.id,
            inspectionType: dailyInspectionType(type),
          })}
          items={items}
          readingLabel={readingLabel(type)}
          submitLabel="Submit check"
          cancelHref="/check"
        />
      )}
    </>
  );
}
