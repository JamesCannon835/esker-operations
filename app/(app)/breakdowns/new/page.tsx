import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";
import { BreakdownForm } from "../breakdown-form";

export const dynamic = "force-dynamic";

export default async function NewBreakdownPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { user, roles } = await requireUser();
  const { id } = await searchParams;
  const supabase = await createClient();

  const canSeeAll = isManager(roles) || hasRole(roles, "mechanic");
  let q = supabase
    .from("vehicles")
    .select("id, fleet_number, registration")
    .eq("voided", false)
    .order("fleet_number");
  if (!canSeeAll) q = q.eq("assigned_driver_id", user.id);
  const { data: vehicles } = await q;

  const options = (vehicles ?? []).map((v) => ({
    id: v.id,
    label: `${v.fleet_number} · ${v.registration}`,
  }));

  return (
    <>
      <Link className="link-back" href="/dashboard">
        ← Dashboard
      </Link>
      <div className="page-head">
        <h1>Report a breakdown</h1>
      </div>
      <div className="card">
        {options.length === 0 ? (
          <p className="empty">
            No vehicle is assigned to you. Ask your manager, or call the yard.
          </p>
        ) : (
          <BreakdownForm vehicles={options} defaultVehicle={id} />
        )}
      </div>
    </>
  );
}
