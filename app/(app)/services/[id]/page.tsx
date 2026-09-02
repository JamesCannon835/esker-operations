import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";
import { resolveAssetLabels, assetHref } from "@/lib/asset-labels";
import { fmtDate, fmtNumber } from "@/lib/format";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteService } from "../actions";

export const dynamic = "force-dynamic";

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { roles } = await requireUser();
  const canEdit = isManager(roles) || hasRole(roles, "mechanic");
  const showCost = isManager(roles);

  const supabase = await createClient();
  const { data: service } = await supabase
    .from("services")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!service) notFound();

  const [{ data: person }, labels] = await Promise.all([
    service.performed_by
      ? supabase
          .from("users")
          .select("full_name")
          .eq("id", service.performed_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    resolveAssetLabels([service]),
  ]);

  const assetLabel =
    labels.get(`${service.asset_type}:${service.asset_id}`) ?? "—";
  const href = assetHref(service.asset_type, service.asset_id);

  return (
    <>
      <Link className="link-back" href="/services">
        ← Services
      </Link>
      <div className="page-head">
        <h1>Service — {assetLabel}</h1>
      </div>

      <div className="card">
        <div className="detail-grid">
          <div>
            <div className="label">Date</div>
            <div className="value">{fmtDate(service.service_date)}</div>
          </div>
          <div>
            <div className="label">Asset</div>
            <div className="value">
              {href ? <Link href={href}>{assetLabel}</Link> : assetLabel}
            </div>
          </div>
          <div>
            <div className="label">Mileage / hours</div>
            <div className="value">{fmtNumber(service.mileage_or_hours)}</div>
          </div>
          <div>
            <div className="label">Performed by</div>
            <div className="value">
              {(person as { full_name?: string } | null)?.full_name ?? "—"}
            </div>
          </div>
          {showCost && (
            <div>
              <div className="label">Cost</div>
              <div className="value">
                {service.cost != null
                  ? `€${Number(service.cost).toFixed(2)}`
                  : "—"}
              </div>
            </div>
          )}
        </div>
      </div>

      {service.notes && (
        <div className="card">
          <h2>Notes</h2>
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{service.notes}</p>
        </div>
      )}

      {canEdit && (
        <div className="card">
          <h2>Manage</h2>
          <ConfirmButton
            action={deleteService.bind(null, id)}
            label="Delete this service record"
            className="btn danger"
            confirmText="Delete this service record? This cannot be undone."
          />
        </div>
      )}
    </>
  );
}
