import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isManager, type Role } from "@/lib/roles";
import { DOC_BUCKET } from "@/lib/doc-library";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const home = new URL(`/toolbox/${id}`, request.url);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const roles = (roleRows ?? []).map((r) => r.role as Role);

  const [{ data: talk }, { data: recip }] = await Promise.all([
    supabase
      .from("toolbox_talks")
      .select("document_id")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("toolbox_talk_recipients")
      .select("id")
      .eq("talk_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!isManager(roles) && !recip) {
    return NextResponse.redirect(new URL("/toolbox", request.url));
  }
  if (!talk?.document_id) return NextResponse.redirect(home);

  // The caller is an authorised recipient/manager of this talk, but a driver
  // can't read hs_documents directly (RLS is management-only) — resolve the
  // one linked file with the service client, scoped to this talk's document.
  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("hs_documents")
    .select("file_path")
    .eq("id", talk.document_id)
    .maybeSingle();
  if (!doc?.file_path) return NextResponse.redirect(home);

  const { data, error } = await admin.storage
    .from(DOC_BUCKET)
    .createSignedUrl(doc.file_path, 180);
  if (error || !data) return NextResponse.redirect(home);
  return NextResponse.redirect(data.signedUrl);
}
