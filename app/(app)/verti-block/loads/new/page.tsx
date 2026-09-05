import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isManager, hasRole } from "@/lib/roles";
import { LoadForm } from "../load-form";
import { createLoad } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewLoadPage() {
  const { roles } = await requireUser();
  if (!hasRole(roles, "plant_operator") && !isManager(roles)) {
    redirect("/dashboard");
  }

  return (
    <>
      <Link className="link-back" href="/verti-block/loads">
        ← Loads
      </Link>
      <div className="page-head">
        <h1>New load</h1>
      </div>
      <div className="card">
        <LoadForm action={createLoad} submitLabel="Create load" />
      </div>
      <p className="hint">
        Create the load, then add the blocks on the next screen — the total
        weight builds up as you go.
      </p>
    </>
  );
}
