import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENTS_BUCKET } from "@/lib/documents";

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

  const { data: doc } = await supabase
    .from("documents")
    .select("file_url")
    .eq("id", id)
    .maybeSingle();

  if (!doc?.file_url) {
    return NextResponse.redirect(new URL("/documents", request.url));
  }

  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(doc.file_url, 120);

  if (error || !data) {
    return NextResponse.redirect(new URL("/documents", request.url));
  }

  return NextResponse.redirect(data.signedUrl);
}
