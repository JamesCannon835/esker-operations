import Link from "next/link";
import { createTemplate } from "../actions";
import { TemplateForm } from "../template-form";

export const dynamic = "force-dynamic";

export default function NewChecklistPage() {
  return (
    <>
      <Link className="link-back" href="/checklists">
        ← Checklists
      </Link>
      <div className="page-head">
        <h1>New checklist</h1>
      </div>
      <div className="card">
        <TemplateForm
          action={createTemplate}
          submitLabel="Create checklist"
          cancelHref="/checklists"
        />
        <p className="field-hint" style={{ marginTop: 12 }}>
          You&apos;ll add the checklist items on the next screen.
        </p>
      </div>
    </>
  );
}
