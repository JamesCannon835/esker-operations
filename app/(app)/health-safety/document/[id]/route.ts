import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasRole, isManager, type Role } from "@/lib/roles";
import { HS_BUCKET } from "@/lib/health-safety";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const { data: doc } = await supabase
    .from("hs_documents")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();
  if (!doc?.file_path) {
    return NextResponse.redirect(new URL("/health-safety", request.url));
  }

  const { data, error } = await supabase.storage
    .from(HS_BUCKET)
    .createSignedUrl(doc.file_path, 180);
  if (error || !data) {
    return NextResponse.redirect(new URL("/health-safety", request.url));
  }
  return NextResponse.redirect(data.signedUrl);
}
