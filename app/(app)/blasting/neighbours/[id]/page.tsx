import Link from "next/link";
import { notFound } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NeighbourForm } from "../../neighbour-form";
import { saveNeighbour } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditNeighbourPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireManager();
  const { id } = await params;
  const supabase = await createClient();

  const { data: n } = await supabase
    .from("neighbours")
    .select("id, name, phone, address, notes, active")
    .eq("id", id)
    .maybeSingle();
  if (!n) notFound();

  return (
    <>
      <Link className="link-back" href="/blasting/neighbours">
        ← Neighbours
      </Link>
      <div className="page-head">
        <h1>{n.name}</h1>
      </div>
      <div className="card">
        <NeighbourForm
          action={saveNeighbour.bind(null, n.id)}
          defaults={n}
          submitLabel="Save"
        />
      </div>
    </>
  );
}
