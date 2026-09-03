import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { BreakdownForm } from "../breakdown-form";
import { vehicleName } from "@/lib/asset-name";

export const dynamic = "force-dynamic";

export default async function NewBreakdownPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  await requireUser();
  const { id } = await searchParams;
  const supabase = await createClient();

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, fleet_number, registration")
    .eq("voided", false)
    .order("registration");

  const options = (vehicles ?? []).map((v) => ({
    id: v.id,
    label: vehicleName(v.fleet_number, v.registration),
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
          <p className="empty">No vehicles on record. Call the yard.</p>
        ) : (
          <BreakdownForm vehicles={options} defaultVehicle={id} />
        )}
      </div>
    </>
  );
}
