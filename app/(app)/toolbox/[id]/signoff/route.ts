import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isManager, type Role } from "@/lib/roles";
import { DOC_BUCKET } from "@/lib/doc-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const INK = rgb(0.106, 0.102, 0.094);
const GREY = rgb(0.42, 0.39, 0.36);

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
  if (!isManager(roles)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const admin = createAdminClient();
  const { data: talk } = await admin
    .from("toolbox_talks")
    .select("title, talk_date, body, document_id, sent_at, status")
    .eq("id", id)
    .maybeSingle();
  if (!talk) return NextResponse.redirect(new URL("/toolbox", request.url));

  const { data: recips } = await admin
    .from("toolbox_talk_recipients")
    .select("user_id, signed_at, signature_data")
    .eq("talk_id", id);
  const { data: people } = await admin.from("users").select("id, full_name");
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name as string]));

  const rows = (recips ?? [])
    .map((r) => ({
      name: nameOf.get(r.user_id) ?? "—",
      signed_at: r.signed_at as string | null,
      signature_data: r.signature_data as string | null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const signedCount = rows.filter((r) => r.signed_at).length;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage(A4);
  let y = A4[1] - MARGIN;
  const width = A4[0] - MARGIN * 2;

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short" }) : "—";
  const fmtD = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-IE", { dateStyle: "medium" }) : "—";

  const wrap = (text: string, size: number, f = font) => {
    const out: string[] = [];
    for (const para of text.split(/\r?\n/)) {
      if (para.trim() === "") {
        out.push("");
        continue;
      }
      let line = "";
      for (const word of para.split(/\s+/)) {
        const trial = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(trial, size) > width && line) {
          out.push(line);
          line = word;
        } else {
          line = trial;
        }
      }
      if (line) out.push(line);
    }
    return out;
  };

  const need = (space: number) => {
    if (y - space < MARGIN) {
      page = pdf.addPage(A4);
      y = A4[1] - MARGIN;
    }
  };

  const text = (s: string, size: number, f = font, color = INK) => {
    need(size + 6);
    page.drawText(s, { x: MARGIN, y: y - size, size, font: f, color });
    y -= size + 6;
  };

  text("TOOLBOX TALK — SIGN-OFF RECORD", 16, bold);
  y -= 4;
  text(talk.title, 13, bold);
  text(`Talk date: ${fmtD(talk.talk_date)}`, 10, font, GREY);
  text(
    `Sent: ${fmtD(talk.sent_at)}   ·   Signed: ${signedCount} of ${rows.length}`,
    10,
    font,
    GREY,
  );
  text(`Generated: ${fmt(new Date().toISOString())}`, 10, font, GREY);
  y -= 8;

  if (talk.body) {
    text("Talk", 11, bold);
    for (const line of wrap(talk.body, 10)) text(line || " ", 10);
    y -= 8;
  }

  // Signature list
  need(24);
  text("Attendance & signatures", 11, bold);
  y -= 2;

  for (const r of rows) {
    need(60);
    page.drawText(r.name, { x: MARGIN, y: y - 11, size: 11, font: bold, color: INK });
    page.drawText(
      r.signed_at ? `Signed ${fmt(r.signed_at)}` : "NOT SIGNED",
      {
        x: MARGIN + 220,
        y: y - 11,
        size: 9,
        font,
        color: r.signed_at ? GREY : rgb(0.6, 0.1, 0.1),
      },
    );
    y -= 16;
    if (r.signature_data?.startsWith("data:image/png;base64,")) {
      try {
        const bytes = Buffer.from(
          r.signature_data.split(",", 2)[1],
          "base64",
        );
        const png = await pdf.embedPng(bytes);
        const h = 38;
        const w = Math.min((png.width / png.height) * h, 200);
        need(h + 8);
        page.drawImage(png, { x: MARGIN, y: y - h, width: w, height: h });
        y -= h + 6;
      } catch {
        y -= 4;
      }
    }
    page.drawLine({
      start: { x: MARGIN, y: y - 2 },
      end: { x: MARGIN + width, y: y - 2 },
      thickness: 0.5,
      color: rgb(0.85, 0.83, 0.8),
    });
    y -= 12;
  }

  // Append the linked document if it's a PDF.
  if (talk.document_id) {
    const { data: doc } = await admin
      .from("hs_documents")
      .select("file_path, content_type")
      .eq("id", talk.document_id)
      .maybeSingle();
    if (doc?.file_path) {
      const { data: file } = await admin.storage
        .from(DOC_BUCKET)
        .download(doc.file_path);
      if (file && (doc.content_type ?? "").includes("pdf")) {
        try {
          const ext = await PDFDocument.load(await file.arrayBuffer());
          const copied = await pdf.copyPages(ext, ext.getPageIndices());
          copied.forEach((p) => pdf.addPage(p));
        } catch {
          /* skip an unreadable PDF */
        }
      }
    }
  }

  const bytes = await pdf.save();
  const safe = talk.title.replace(/[^A-Za-z0-9]+/g, "-").slice(0, 60);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="toolbox-${safe}-signoff.pdf"`,
    },
  });
}
