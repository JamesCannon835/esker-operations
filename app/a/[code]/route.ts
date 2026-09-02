import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * QR-code landing point. Looks up which asset owns this qr_code and
 * redirects to its record. Unknown code -> dashboard.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  for (const [table, path] of [
    ["vehicles", "vehicles"],
    ["plant", "plant"],
    ["trailers", "trailers"],
  ] as const) {
    const { data } = await supabase
      .from(table)
      .select("id")
      .eq("qr_code", code)
      .maybeSingle();
    if (data) {
      return NextResponse.redirect(new URL(`/${path}/${data.id}`, request.url));
    }
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
