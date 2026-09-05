import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { requireUser } from "@/lib/auth";
import { canProduction } from "@/lib/roles";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WEEKDAY_NAMES } from "@/lib/verti-block";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE: [number, number] = [841.89, 595.28]; // A4 landscape
const M = 36;
const INK = rgb(0.106, 0.102, 0.094);
const GREY = rgb(0.45, 0.42, 0.39);
const LINE = rgb(0.8, 0.78, 0.75);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { roles } = await requireUser();
  if (!canProduction(roles)) redirect("/dashboard");
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: week }, { data: days }, { data: types }] = await Promise.all([
    supabase
      .from("verti_production_weeks")
      .select("week_commencing, operator_name, notes")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("verti_production_days")
      .select(
        "weekday, day_date, concrete_ordered_m3, counts, broken, block_visual_ok, mould_visual_ok, weight_ok",
      )
      .eq("week_id", id)
      .order("weekday"),
    supabase
      .from("verti_block_types")
      .select("id, name")
      .eq("active", true)
      .order("sort_order")
      .order("name"),
  ]);
  if (!week) redirect("/verti-block");

  const dayByWd = new Map((days ?? []).map((d) => [d.weekday, d]));
  const T = types ?? [];

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const labelW = 165;
  const totalW = 70;
  const dayW = (PAGE[0] - M * 2 - labelW - totalW) / 5;
  const colX = (i: number) => M + labelW + i * dayW; // i 0..4
  const totalX = M + labelW + 5 * dayW;

  let page = pdf.addPage(PAGE);
  let y = 0;

  const num = (v: unknown) =>
    v == null || v === "" ? "" : String(v);
  const tick = (v: boolean | null | undefined) =>
    v == null ? "" : v ? "OK" : "NOT OK";

  const drawHeader = () => {
    y = PAGE[1] - M;
    page.drawText("Verti-Block Weekly Production Record", {
      x: M,
      y: y - 14,
      size: 14,
      font: bold,
      color: INK,
    });
    y -= 24;
    const wc = new Date(`${week.week_commencing}T00:00:00`).toLocaleDateString(
      "en-IE",
      { weekday: "long", day: "numeric", month: "long", year: "numeric" },
    );
    page.drawText(
      `Week commencing: ${wc}      Operator: ${week.operator_name ?? "—"}`,
      { x: M, y: y - 10, size: 10, font, color: GREY },
    );
    y -= 22;
    for (let i = 0; i < 5; i++) {
      const d = dayByWd.get(i + 1);
      const label = d
        ? `${WEEKDAY_NAMES[i].slice(0, 3)} ${new Date(
            `${d.day_date}T00:00:00`,
          ).toLocaleDateString("en-IE", { day: "numeric", month: "numeric" })}`
        : WEEKDAY_NAMES[i].slice(0, 3);
      page.drawText(label, { x: colX(i) + 4, y: y - 10, size: 9, font: bold, color: INK });
    }
    page.drawText("Week", {
      x: totalX + 4,
      y: y - 10,
      size: 9,
      font: bold,
      color: INK,
    });
    y -= 16;
    page.drawLine({
      start: { x: M, y },
      end: { x: PAGE[0] - M, y },
      thickness: 1,
      color: INK,
    });
    y -= 4;
  };

  const ensure = () => {
    if (y < M + 20) {
      page = pdf.addPage(PAGE);
      drawHeader();
    }
  };

  const row = (
    label: string,
    values: string[],
    weekVal: string,
    opts: { header?: boolean } = {},
  ) => {
    ensure();
    page.drawText(label, {
      x: M + (opts.header ? 0 : 4),
      y: y - 10,
      size: 9,
      font: opts.header ? bold : font,
      color: INK,
    });
    if (!opts.header) {
      values.forEach((v, i) => {
        page.drawText(v, {
          x: colX(i) + 4,
          y: y - 10,
          size: 9,
          font,
          color: INK,
        });
      });
      if (weekVal)
        page.drawText(weekVal, {
          x: totalX + 4,
          y: y - 10,
          size: 9,
          font: bold,
          color: INK,
        });
    }
    y -= 14;
    page.drawLine({
      start: { x: M, y: y + 1 },
      end: { x: PAGE[0] - M, y: y + 1 },
      thickness: 0.4,
      color: LINE,
    });
  };

  drawHeader();

  // Concrete ordered
  {
    const vals = [1, 2, 3, 4, 5].map((wd) =>
      num(dayByWd.get(wd)?.concrete_ordered_m3),
    );
    const tot = vals.reduce((s, v) => s + (Number(v) || 0), 0);
    row("Concrete Ordered (m³)", vals, tot ? String(Math.round(tot * 10) / 10) : "");
  }

  const gridSection = (
    title: string,
    pick: (wd: number) => Record<string, number>,
  ) => {
    row(title, [], "", { header: true });
    for (const t of T) {
      const vals = [1, 2, 3, 4, 5].map((wd) => {
        const n = pick(wd)?.[t.id];
        return n ? String(n) : "";
      });
      const tot = vals.reduce((s, v) => s + (Number(v) || 0), 0);
      row(t.name, vals, tot ? String(tot) : "");
    }
  };

  gridSection("BLOCKS MADE", (wd) => (dayByWd.get(wd)?.counts ?? {}) as Record<string, number>);
  gridSection("BLOCKS BROKEN", (wd) => (dayByWd.get(wd)?.broken ?? {}) as Record<string, number>);

  row("INSPECTIONS", [], "", { header: true });
  row(
    "Block visual inspection",
    [1, 2, 3, 4, 5].map((wd) => tick(dayByWd.get(wd)?.block_visual_ok)),
    "",
  );
  row(
    "Mould visual inspection",
    [1, 2, 3, 4, 5].map((wd) => tick(dayByWd.get(wd)?.mould_visual_ok)),
    "",
  );
  row(
    "Weight inspection",
    [1, 2, 3, 4, 5].map((wd) => tick(dayByWd.get(wd)?.weight_ok)),
    "",
  );

  if (week.notes) {
    ensure();
    y -= 6;
    page.drawText(`Notes: ${week.notes}`, { x: M, y: y - 10, size: 9, font, color: GREY });
    y -= 14;
  }

  const bytes = await pdf.save();
  const wc = week.week_commencing;
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="verti-block-week-${wc}.pdf"`,
    },
  });
}
