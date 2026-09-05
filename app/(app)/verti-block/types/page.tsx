import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { ConfirmButton } from "@/components/confirm-button";
import { TypeForm } from "../type-form";
import { deleteType } from "../actions";

export const dynamic = "force-dynamic";

export default async function VbTypesPage() {
  const { roles } = await requireUser();
  if (!isManager(roles)) redirect("/verti-block");
  const supabase = await createClient();

  const { data: types } = await supabase
    .from("verti_block_types")
    .select("id, name, sort_order, active")
    .order("sort_order")
    .order("name");

  return (
    <>
      <Link className="link-back" href="/verti-block">
        ← Verti-Block production
      </Link>
      <div className="page-head">
        <h1>Block types</h1>
      </div>
      <p className="hint">
        These are the columns on the production sheet. Order controls how they
        appear.
      </p>

      <div className="card">
        <div className="del-rows">
          {(types ?? []).map((t) => (
            <details key={t.id} className="del-product">
              <summary>
                <strong>{t.name}</strong>{" "}
                <span className="muted">
                  order {t.sort_order}
                  {t.active ? "" : " · off"}
                </span>
              </summary>
              <div style={{ padding: "10px 0" }}>
                <TypeForm id={t.id} defaults={t} submitLabel="Save" />
                <div style={{ marginTop: 8 }}>
                  <ConfirmButton
                    action={deleteType.bind(null, t.id)}
                    label="Delete"
                    className="btn ghost small"
                    confirmText={`Delete "${t.name}"? If it's used on past sheets it will just be turned off.`}
                  />
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Add a block type</h2>
        <TypeForm id={null} submitLabel="Add" />
      </div>
    </>
  );
}
