import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireUser } from "@/lib/auth";
import { isManager } from "@/lib/roles";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { feetLabel, lineMetres, type PrecastLine } from "@/lib/precast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const A4: [number, number] = [595.28, 841.89];
const M = 48;
const INK = rgb(0.106, 0.102, 0.094);
const GREY = rgb(0.45, 0.42, 0.39);
const LINE = rgb(0.82, 0.8, 0.77);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { roles } = await requireUser();
  if (!isManager(roles)) redirect("/precast");
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order }, { data: lines }] = await Promise.all([
    supabase.from("precast_orders").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("precast_order_lines")
      .select("*")
      .eq("order_id", id)
      .order("sort_order"),
  ]);
  if (!order) redirect("/precast");
  const rows = (lines ?? []) as PrecastLine[];

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage(A4);
  let y = A4[1] - M;
  const width = A4[0] - M * 2;

  const text = (
    s: string,
    size: number,
    f = font,
    color = INK,
    dy = size + 6,
  ) => {
    page.drawText(s, { x: M, y: y - size, size, font: f, color });
    y -= dy;
  };

  text("Esker Readymix — Precast Delivery Docket", 15, bold);
  y -= 2;
  text(order.order_number ?? "Precast order", 12, bold);
  text(
    `Customer: ${order.customer ?? "—"}${order.phone ? `   ${order.phone}` : ""}`,
    10,
    font,
    GREY,
  );
  text(
    `Order date: ${order.order_date}` +
      (order.required_date ? `    Required: ${order.required_date}` : ""),
    10,
    font,
    GREY,
  );
  y -= 10;

  // table header
  const cols = [M, M + 250, M + 340, M + 420, M + width];
  const head = ["Product", "Length", "Qty", "Metres"];
  head.forEach((h, i) =>
    page.drawText(h, { x: cols[i] + 2, y: y - 9, size: 9, font: bold, color: INK }),
  );
  y -= 14;
  page.drawLine({
    start: { x: M, y },
    end: { x: M + width, y },
    thickness: 1,
    color: INK,
  });
  y -= 4;

  let total = 0;
  for (const l of rows) {
    const lm = lineMetres(l) ?? 0;
    total += lm;
    const cells = [
      l.product_name + (l.notes ? ` (${l.notes})` : ""),
      l.length_text || feetLabel(l.length_ft),
      String(l.quantity),
      `${lm.toFixed(2)} m`,
    ];
    // wrap product name if long
    const name = cells[0];
    const maxCharsPerLine = 46;
    const nameLines: string[] = [];
    for (let i = 0; i < name.length; i += maxCharsPerLine)
      nameLines.push(name.slice(i, i + maxCharsPerLine));
    const rowH = Math.max(14, nameLines.length * 11 + 3);

    nameLines.forEach((nl, i) =>
      page.drawText(nl, {
        x: cols[0] + 2,
        y: y - 9 - i * 11,
        size: 9,
        font,
        color: INK,
      }),
    );
    page.drawText(cells[1], { x: cols[1] + 2, y: y - 9, size: 9, font, color: INK });
    page.drawText(cells[2], { x: cols[2] + 2, y: y - 9, size: 9, font, color: INK });
    page.drawText(cells[3], { x: cols[3] + 2, y: y - 9, size: 9, font, color: INK });
    y -= rowH;
    page.drawLine({
      start: { x: M, y: y + 2 },
      end: { x: M + width, y: y + 2 },
      thickness: 0.4,
      color: LINE,
    });
  }

  y -= 8;
  page.drawText(`Total: ${total.toFixed(2)} m`, {
    x: cols[2],
    y: y - 11,
    size: 11,
    font: bold,
    color: INK,
  });

  if (order.notes) {
    y -= 26;
    page.drawText(`Notes: ${order.notes}`, {
      x: M,
      y: y - 9,
      size: 9,
      font,
      color: GREY,
    });
  }

  const bytes = await pdf.save();
  const safe = (order.order_number ?? "order").replace(/[^A-Za-z0-9]+/g, "-");
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="precast-docket-${safe}.pdf"`,
    },
  });
}
