import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MAINTENANCE_BUCKET } from "@/lib/maintenance";

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

  const { data: att } = await supabase
    .from("maintenance_attachments")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();
  if (!att?.file_path) {
    return NextResponse.redirect(new URL("/maintenance", request.url));
  }

  const { data, error } = await supabase.storage
    .from(MAINTENANCE_BUCKET)
    .createSignedUrl(att.file_path, 120);
  if (error || !data) {
    return NextResponse.redirect(new URL("/maintenance", request.url));
  }
  return NextResponse.redirect(data.signedUrl);
}
