"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { ROLES, ROLE_LABELS } from "@/lib/roles";
import { parseTable, colIndex, looksLikeEmail } from "@/lib/import-parse";
import { importPeople, type ImportState } from "../actions";

type Preview = { name: string; email: string; phone: string; ok: boolean };

export function ImportPeopleForm() {
  const [text, setText] = useState("");
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    importPeople,
    {},
  );

  const preview = useMemo<Preview[]>(() => {
    const { headers, rows } = parseTable(text);
    if (rows.length === 0) return [];
    const iName = Math.max(0, colIndex(headers, "name"));
    const iEmail = colIndex(headers, "email", "e-mail");
    const iPhone = colIndex(headers, "phone", "mobile");
    return rows.map((r) => {
      const email = (iEmail >= 0 ? r[iEmail] : r[1]) ?? "";
      const name = (r[iName] ?? "").trim();
      return {
        name,
        email: email.trim(),
        phone: (iPhone >= 0 ? (r[iPhone] ?? "") : "").trim(),
        ok: !!name && looksLikeEmail(email),
      };
    });
  }, [text]);

  const good = preview.filter((p) => p.ok);
  const results = state.results;

  if (results) {
    const created = results.filter((r) => r.status === "created");
    return (
      <>
        <div className="ok">
          {created.length} created, {results.length - created.length} skipped or
          failed. <strong>Print or screenshot this — codes are shown once.</strong>
        </div>
        <table className="list-table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Access code</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i}>
                <td>{r.name}</td>
                <td className="muted">{r.email}</td>
                <td>
                  {r.code ? (
                    <strong style={{ fontFamily: "monospace" }}>{r.code}</strong>
                  ) : (
                    "—"
                  )}
                </td>
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
          <Link className="btn" href="/admin/users">
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
        <label htmlFor="role">Role for everyone in this list</label>
        <select id="role" name="role" defaultValue="driver">
          <option value="">— no role —</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="paste">Paste rows</label>
        <textarea
          id="paste"
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Name\tEmail\tPhone\nJohn Murphy\tjohn@example.com\t087..."}
          style={{ fontFamily: "monospace", fontSize: 13 }}
        />
        <div className="field-hint">
          Open the spreadsheet, select the name/email columns (with the header
          row), copy, and paste here. A “phone” column is used if present.
        </div>
      </div>

      {preview.length > 0 && (
        <>
          <p className="hint">
            {good.length} of {preview.length} rows look good.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="list-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 60).map((p, i) => (
                  <tr key={i}>
                    <td>{p.name || <span className="blocked">missing</span>}</td>
                    <td className="muted">{p.email}</td>
                    <td className="muted">{p.phone || "—"}</td>
                    <td>{p.ok ? "✓" : <span className="blocked">skip</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <input type="hidden" name="rows" value={JSON.stringify(good)} />

      <div className="btn-row">
        <button
          className="btn"
          type="submit"
          disabled={pending || good.length === 0}
        >
          {pending
            ? "Creating…"
            : `Create ${good.length} ${good.length === 1 ? "person" : "people"}`}
        </button>
        <Link className="btn ghost" href="/admin/users">
          Cancel
        </Link>
      </div>
    </form>
  );
}
