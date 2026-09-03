import Link from "next/link";
import { createPlant } from "../actions";
import { PlantForm } from "../plant-form";

export const dynamic = "force-dynamic";

export default function NewPlantPage() {
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
          mode="create"
          submitLabel="Add plant item"
          cancelHref="/plant"
        />
        <p className="field-hint" style={{ marginTop: 12 }}>
          Set hours and service schedule after saving, on the item&apos;s page.
        </p>
      </div>
    </>
  );
}
