import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ASSET_TYPE_LABELS, type AssetTypeT } from "@/lib/inspections";
import { TemplateForm } from "../template-form";
import { DeleteTemplateButton } from "./delete-template-button";
import {
  updateTemplate,
  addItem,
  renameItem,
  deleteItem,
  moveItem,
  deleteTemplate,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function EditChecklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: template }, { data: items }] = await Promise.all([
    supabase
      .from("inspection_templates")
      .select("id, name, asset_type, category")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("inspection_template_items")
      .select("id, item_name, sort_order")
      .eq("template_id", id)
      .order("sort_order"),
  ]);

  if (!template) notFound();
  const list = items ?? [];

  return (
    <>
      <Link className="link-back" href="/checklists">
        ← Checklists
      </Link>
      <div className="page-head">
        <h1>{template.name}</h1>
        <span className="badge">
          {ASSET_TYPE_LABELS[template.asset_type as AssetTypeT] ??
            template.asset_type}
        </span>
      </div>

      <div className="card">
        <h2>Checklist details</h2>
        <TemplateForm
          action={updateTemplate.bind(null, id)}
          defaults={template}
          submitLabel="Save details"
          cancelHref="/checklists"
          lockAssetType
        />
      </div>

      <div className="card">
        <h2>Items ({list.length})</h2>
        <p className="hint">
          These are the checks the driver / operator ticks off. Order is the
          order they appear.
        </p>

        {list.length === 0 && (
          <p className="empty">No items yet — add the first one below.</p>
        )}

        {list.map((item, idx) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              padding: "8px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span className="muted" style={{ width: 24, textAlign: "right" }}>
              {idx + 1}.
            </span>
            <form
              action={renameItem.bind(null, id)}
              style={{ display: "flex", gap: 6, flex: 1 }}
            >
              <input type="hidden" name="item_id" value={item.id} />
              <input
                name="item_name"
                defaultValue={item.item_name}
                style={{
                  flex: 1,
                  padding: "7px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
              <button className="btn ghost small" type="submit">
                Save
              </button>
            </form>
            <form action={moveItem.bind(null, id, item.id, "up")}>
              <button
                className="btn ghost small"
                type="submit"
                disabled={idx === 0}
                aria-label="Move up"
              >
                ↑
              </button>
            </form>
            <form action={moveItem.bind(null, id, item.id, "down")}>
              <button
                className="btn ghost small"
                type="submit"
                disabled={idx === list.length - 1}
                aria-label="Move down"
              >
                ↓
              </button>
            </form>
            <form action={deleteItem.bind(null, id, item.id)}>
              <button className="btn ghost small" type="submit">
                Delete
              </button>
            </form>
          </div>
        ))}

        <form
          action={addItem.bind(null, id)}
          style={{ display: "flex", gap: 8, marginTop: 16 }}
        >
          <input
            name="item_name"
            required
            placeholder="New check item…"
            style={{
              flex: 1,
              padding: "9px 11px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 14,
            }}
          />
          <button className="btn" type="submit">
            Add item
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Delete checklist</h2>
        <p className="hint">
          Only possible if no inspection has used it. Otherwise, leave it in
          place — completed inspections reference it.
        </p>
        <DeleteTemplateButton action={deleteTemplate.bind(null, id)} />
      </div>
    </>
  );
}
