import Link from "next/link";
import { getAssignablePeople } from "@/lib/assets-server";
import { createPlant } from "../actions";
import { PlantForm } from "../plant-form";

export const dynamic = "force-dynamic";

export default async function NewPlantPage() {
  const operators = await getAssignablePeople("plant_operator");

  return (
    <>
      <Link className="link-back" href="/plant">
        ← Plant
      </Link>
      <div className="page-head">
        <h1>Add plant</h1>
      </div>
      <div className="card">
        <PlantForm
          action={createPlant}
          operators={operators}
          submitLabel="Create plant item"
          cancelHref="/plant"
        />
      </div>
    </>
  );
}
