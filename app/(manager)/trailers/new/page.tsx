import Link from "next/link";
import { getVehiclesForAssignment } from "@/lib/assets-server";
import { createTrailer } from "../actions";
import { TrailerForm } from "../trailer-form";

export const dynamic = "force-dynamic";

export default async function NewTrailerPage() {
  const vehicles = await getVehiclesForAssignment();

  return (
    <>
      <Link className="link-back" href="/trailers">
        ← Trailers
      </Link>
      <div className="page-head">
        <h1>Add trailer</h1>
      </div>
      <div className="card">
        <TrailerForm
          action={createTrailer}
          vehicles={vehicles}
          submitLabel="Create trailer"
          cancelHref="/trailers"
        />
      </div>
    </>
  );
}
