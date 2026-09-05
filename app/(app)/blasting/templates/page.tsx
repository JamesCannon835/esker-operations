import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConfirmButton } from "@/components/confirm-button";
import { TemplateForm } from "./template-form";
import { deleteTemplate } from "../actions";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  await requireManager();
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("sms_templates")
    .select("id, name, body")
    .order("name");

  return (
    <>
      <Link className="link-back" href="/blasting">
        ← Blast notifications
      </Link>
      <div className="page-head">
        <h1>Message templates</h1>
      </div>
      <p className="hint">
        Use <code>{"{date}"}</code> and <code>{"{time}"}</code> — they fill in
        from the blast time when you pick the template.
      </p>

      <div className="card">
        {!templates || templates.length === 0 ? (
          <p className="empty">No templates.</p>
        ) : (
          <table className="list-table">
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.name}</strong>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {t.body}
                    </div>
                  </td>
                  <td style={{ textAlign: "right", width: 80 }}>
                    <ConfirmButton
                      action={deleteTemplate.bind(null, t.id)}
                      label="Delete"
                      className="btn ghost small"
                      confirmText={`Delete the "${t.name}" template?`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Add a template</h2>
        <TemplateForm />
      </div>
    </>
  );
}
