import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canProduction } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function VertiBlockHomePage() {
  const { roles } = await requireUser();
  if (!canProduction(roles)) redirect("/dashboard");

  return (
    <>
      <div className="page-head">
        <h1>Verti-Block</h1>
      </div>
      <div className="grid">
        <Link className="tile" href="/verti-block/sheets" style={{ padding: "20px 16px" }}>
          <div className="value" style={{ fontSize: 18 }}>
            🧱 Production sheets
          </div>
          <div className="label" style={{ marginTop: 4 }}>
            Weekly record — blocks made, broken, inspections
          </div>
        </Link>
        <Link className="tile" href="/verti-block/loads" style={{ padding: "20px 16px" }}>
          <div className="value" style={{ fontSize: 18 }}>
            🚚 Load builder
          </div>
          <div className="label" style={{ marginTop: 4 }}>
            Build an order — weight and value against the truck
          </div>
        </Link>
      </div>
    </>
  );
}
