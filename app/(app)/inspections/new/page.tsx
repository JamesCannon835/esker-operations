import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";
import { getAssetOptions } from "@/lib/asset-picker";
import {
  SCHEDULED_TYPE,
  ASSET_TYPE_LABELS,
  readingLabel,
  type AssetTypeT,
} from "@/lib/inspections";
import { submitInspection } from "@/app/(app)/inspections/actions";
import { InspectionForm } from "@/components/inspection-form";
import { vehicleName } from "@/lib/asset-name";

export const dynamic = "force-dynamic";

export default async function NewInspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ asset?: string; template?: string }>;
}) {
  const { roles } = await requireUser();
  if (!isManager(roles) && !hasRole(roles, "mechanic")) redirect("/inspections");

  const { asset, template: templateId } = await searchParams;
  const supabase = await createClient();

  // Step 1 — choose the asset
  if (!asset || !asset.includes(":")) {
    const assets = await getAssetOptions();
    const groups = [...new Set(assets.map((a) => a.group))];
    return (
      <>
        <Link className="link-back" href="/inspections">
          ← Inspections
        </Link>
        <div className="page-head">
          <h1>New inspection</h1>
        </div>
        <div className="card">
          <form method="get">
            <div className="field">
              <label htmlFor="asset">
                Asset <span className="req">*</span>
              </label>
              <select id="asset" name="asset" required defaultValue="">
                <option value="">— Choose asset —</option>
                {groups.map((g) => (
                  <optgroup key={g} label={g}>
                    {assets
                      .filter((a) => a.group === g)
                      .map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="btn-row">
              <button className="btn" type="submit">
                Continue
              </button>
            </div>
          </form>
          <p className="field-hint" style={{ marginTop: 10 }}>
            For daily checks, use <Link href="/check">Daily Check</Link> instead.
          </p>
        </div>
      </>
    );
  }

  const [assetType, assetId] = asset.split(":") as [AssetTypeT, string];

  const table =
    assetType === "plant"
      ? "plant"
      : assetType === "trailer"
        ? "trailers"
        : "vehicles";
  const { data: assetRow } = await supabase
    .from(table)
    .select("*")
    .eq("id", assetId)
    .maybeSingle();
  if (!assetRow) notFound();
  const assetLabel =
    assetType === "plant"
      ? `${assetRow.asset_number}${assetRow.plant_type ? ` · ${assetRow.plant_type}` : ""}`
      : assetType === "trailer"
        ? assetRow.registration
        : vehicleName(assetRow.fleet_number, assetRow.registration);

  const { data: templates } = await supabase
    .from("inspection_templates")
    .select("id, name")
    .eq("asset_type", assetType)
    .order("name");
  // Daily-check templates belong to the driver/operator flow, not here.
  const list = (templates ?? []).filter((t) => !/daily/i.test(t.name));

  const chosen =
    (templateId && list.find((t) => t.id === templateId)) ||
    (list.length === 1 ? list[0] : undefined);

  // Step 2 — choose a checklist if there's more than one
  if (!chosen) {
    return (
      <>
        <Link className="link-back" href="/inspections/new">
          ← Start over
        </Link>
        <div className="page-head">
          <h1>Inspection — {assetLabel}</h1>
        </div>
        <div className="card">
          {list.length === 0 ? (
            <p className="empty">
              No {ASSET_TYPE_LABELS[assetType].toLowerCase()} checklist exists.
              Create one under <Link href="/checklists">Checklists</Link>.
            </p>
          ) : (
            <>
              <h2>Choose a checklist</h2>
              <ul>
                {list.map((t) => (
                  <li key={t.id} style={{ margin: "8px 0" }}>
                    <Link href={`/inspections/new?asset=${asset}&template=${t.id}`}>
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </>
    );
  }

  const { data: items } = await supabase
    .from("inspection_template_items")
    .select("id, item_name, sort_order")
    .eq("template_id", chosen.id)
    .order("sort_order");

  return (
    <>
      <Link className="link-back" href="/inspections/new">
        ← Inspections
      </Link>
      <div className="page-head">
        <h1>Inspection — {assetLabel}</h1>
        <span className="badge">{chosen.name}</span>
      </div>

      {!items || items.length === 0 ? (
        <div className="card">
          <p className="empty">
            That checklist has no items yet. Add some under{" "}
            <Link href={`/checklists/${chosen.id}`}>Checklists</Link>.
          </p>
        </div>
      ) : (
        <InspectionForm
          action={submitInspection.bind(null, {
            assetType,
            assetId,
            templateId: chosen.id,
            inspectionType: SCHEDULED_TYPE,
          })}
          items={items}
          readingLabel={readingLabel(
            assetType === "plant" ? "plant" : "vehicle",
          )}
          submitLabel="Submit inspection"
          cancelHref="/inspections"
          showService
        />
      )}
    </>
  );
}
