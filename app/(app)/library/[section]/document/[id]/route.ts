import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasRole, isManager, type Role } from "@/lib/roles";
import { DOC_BUCKET, sectionFromSlug } from "@/lib/doc-library";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ section: string; id: string }> },
) {
  const { section: slug, id } = await params;
  const section = sectionFromSlug(slug);
  const home = new URL(section ? `/library/${slug}` : "/dashboard", request.url);
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
  if (!hasRole(roles, "mechanic") && !isManager(roles)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (!section) return NextResponse.redirect(home);

  const { data: doc } = await supabase
    .from("hs_documents")
    .select("file_path, section")
    .eq("id", id)
    .maybeSingle();
  if (!doc?.file_path || doc.section !== section) {
    return NextResponse.redirect(home);
  }

  const { data, error } = await supabase.storage
    .from(DOC_BUCKET)
    .createSignedUrl(doc.file_path, 180);
  if (error || !data) return NextResponse.redirect(home);
  return NextResponse.redirect(data.signedUrl);
}
