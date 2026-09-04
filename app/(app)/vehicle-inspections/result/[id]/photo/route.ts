import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { VI_BUCKET } from "@/lib/vehicle-inspection";

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

  const { data: row } = await supabase
    .from("vehicle_inspection_results")
    .select("photo_path")
    .eq("id", id)
    .maybeSingle();
  if (!row?.photo_path) {
    return NextResponse.redirect(new URL("/vehicle-inspections", request.url));
  }

  const { data, error } = await supabase.storage
    .from(VI_BUCKET)
    .createSignedUrl(row.photo_path, 120);
  if (error || !data) {
    return NextResponse.redirect(new URL("/vehicle-inspections", request.url));
  }
  return NextResponse.redirect(data.signedUrl);
}
