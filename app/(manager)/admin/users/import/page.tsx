import Link from "next/link";
import { ImportPeopleForm } from "./import-people-form";

export const dynamic = "force-dynamic";

export default function ImportPeoplePage() {
  return (
    <>
      <Link className="link-back" href="/admin/users">
        ← Users
      </Link>
      <div className="page-head">
        <h1>Import people</h1>
      </div>
      <div className="card">
        <p className="hint">
          Creates a login for each person with an access code you hand out — no
          email is sent. People whose email already has a login are skipped.
        </p>
        <ImportPeopleForm />
      </div>
    </>
  );
}
