"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { fmtDate } from "@/lib/format";
import type { ComplianceType } from "@/lib/compliance";
import {
  parseTable,
  colIndex,
  parseImportDate,
  normaliseReg,
} from "@/lib/import-parse";
import {
  importVehicles,
  type VehicleImportState,
  type VehicleImportRow,
} from "../actions";

const DATE_COLS: { type: ComplianceType; label: string; needles: string[] }[] = [
  { type: "tax", label: "Tax", needles: ["tax"] },
  { type: "cvrt_test", label: "CVRT / DOE", needles: ["doe", "cvrt"] },
  { type: "tacho_calibration", label: "Tacho", needles: ["taco", "tacho"] },
  {
    type: "thirteen_week_inspection",
    label: "Inspection",
    needles: ["inspection", "13"],
  },
  { type: "insurance", label: "Insurance", needles: ["insurance"] },
  { type: "service", label: "Service", needles: ["service"] },
];

type Preview = VehicleImportRow & {
  raw: string;
  skip: boolean;
  note: string;
  dates: Partial<Record<ComplianceType, string>>;
};

export function ImportVehiclesForm() {
  const [text, setText] = useState("");
  const [state, formAction, pending] = useActionState<
    VehicleImportState,
    FormData
  >(importVehicles, {});

  const preview = useMemo<Preview[]>(() => {
    const { headers, rows } = parseTable(text);
    if (rows.length === 0) return [];
    const iReg = Math.max(0, colIndex(headers, "reg"));
    const iTaxBook = colIndex(headers, "tax book", "book number");
    const dateIdx = DATE_COLS.map((d) => ({
      ...d,
      idx: colIndex(headers, ...d.needles),
    }));

    return rows
      .map((r): Preview | null => {
        const rawReg = (r[iReg] ?? "").trim();
        if (!rawReg) return null;
        const rowText = r.join(" ").toLowerCase();
        const isSold = /\bsold\b/.test(rowText);
        const offRoad = /off\s*road/.test(rowText);
        // ignore non-vehicle helper rows
        if (/top up|download|column1/i.test(rawReg)) return null;

        const dates: Partial<Record<ComplianceType, string>> = {};
        for (const d of dateIdx) {
          if (d.idx < 0) continue;
          const iso = parseImportDate(r[d.idx]);
          if (iso) dates[d.type] = iso;
        }

        const taxBook = iTaxBook >= 0 ? (r[iTaxBook] ?? "").trim() : "";
        return {
          registration: normaliseReg(rawReg),
          raw: rawReg,
          notes: taxBook ? `Tax book: ${taxBook}` : undefined,
          status: offRoad ? "off_road" : undefined,
          dates,
          skip: isSold,
          note: isSold ? "sold — skipped" : offRoad ? "off road" : "",
        };
      })
      .filter((p): p is Preview => p !== null);
  }, [text]);

  const toImport = preview.filter((p) => !p.skip);
  const payload: VehicleImportRow[] = toImport.map((p) => ({
    registration: p.registration,
    notes: p.notes,
    status: p.status,
    dates: p.dates,
  }));

  const results = state.results;
  if (results) {
    const created = results.filter((r) => r.status === "created");
    return (
      <>
        <div className="ok">
          {created.length} vehicles created (
          {created.reduce((a, r) => a + r.dates, 0)} compliance dates),{" "}
          {results.length - created.length} skipped or failed.
        </div>
        <table className="list-table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Registration</th>
              <th>Dates</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i}>
                <td>{r.registration || "—"}</td>
                <td className="muted">{r.dates || "—"}</td>
                <td
                  className={r.status === "created" ? "ok" : "blocked"}
                  style={{ fontSize: 13 }}
                >
                  {r.status}
                  {r.detail ? ` — ${r.detail}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="btn-row">
          <Link className="btn" href="/vehicles">
            Done
          </Link>
        </div>
      </>
    );
  }

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}

      <div className="field">
        <label htmlFor="paste">Paste rows</label>
        <textarea
          id="paste"
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"REG\tTACO\tDOE\tTAX\tINSPECTION\n211 G 2279\t..."}
          style={{ fontFamily: "monospace", fontSize: 13 }}
        />
        <div className="field-hint">
          Include the header row. Recognised date columns: TAX, DOE/CVRT, TACO,
          INSPECTION, INSURANCE, SERVICE. A “tax book number” column goes into
          notes. Rows marked “sold” are skipped; “off road” imported as off-road.
        </div>
      </div>

      {preview.length > 0 && (
        <>
          <p className="hint">
            {toImport.length} to import, {preview.length - toImport.length}{" "}
            skipped.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="list-table">
              <thead>
                <tr>
                  <th>Registration</th>
                  {DATE_COLS.map((d) => (
                    <th key={d.type}>{d.label}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 80).map((p, i) => (
                  <tr key={i} style={p.skip ? { opacity: 0.45 } : undefined}>
                    <td>
                      {p.registration}
                      {p.registration !== p.raw.toUpperCase().trim() && (
                        <span className="muted"> (was {p.raw})</span>
                      )}
                    </td>
                    {DATE_COLS.map((d) => (
                      <td key={d.type} className="muted">
                        {p.dates[d.type] ? fmtDate(p.dates[d.type]) : "—"}
                      </td>
                    ))}
                    <td className="muted" style={{ fontSize: 12 }}>
                      {p.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <input type="hidden" name="rows" value={JSON.stringify(payload)} />

      <div className="btn-row">
        <button
          className="btn"
          type="submit"
          disabled={pending || payload.length === 0}
        >
          {pending ? "Importing…" : `Import ${payload.length} vehicles`}
        </button>
        <Link className="btn ghost" href="/vehicles">
          Cancel
        </Link>
      </div>
    </form>
  );
}
