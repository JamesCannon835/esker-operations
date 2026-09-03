import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/roles";
import { TRAINING_BUCKET } from "@/lib/training";
import type { Role } from "@/lib/roles";

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

  const [{ data: record }, { data: roleRows }] = await Promise.all([
    supabase
      .from("training_records")
      .select("user_id, certificate_path")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  if (!record?.certificate_path) {
    return NextResponse.redirect(new URL("/training", request.url));
  }

  const roles = (roleRows ?? []).map((r) => r.role as Role);
  const allowed = record.user_id === user.id || isManager(roles);
  if (!allowed) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const { data, error } = await supabase.storage
    .from(TRAINING_BUCKET)
    .createSignedUrl(record.certificate_path, 120);

  if (error || !data) {
    return NextResponse.redirect(new URL("/training", request.url));
  }

  return NextResponse.redirect(data.signedUrl);
}
