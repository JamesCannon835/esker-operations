import Link from "next/link";
import { NewUserForm } from "../user-form";

export const dynamic = "force-dynamic";

export default function NewUserPage() {
  return (
    <>
      <Link className="link-back" href="/admin/users">
        ← Users
      </Link>
      <div className="page-head">
        <h1>Add a person</h1>
      </div>
      <div className="card">
        <NewUserForm />
        <p className="field-hint" style={{ marginTop: 12 }}>
          This creates their login, profile and roles in one step. They can sign
          in immediately with the email and starting password.
        </p>
      </div>
    </>
  );
}
