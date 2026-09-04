"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  VI_SEVERITIES,
  VI_SEVERITY_LABELS,
  VI_BUCKET,
  VI_PREFIX,
} from "@/lib/vehicle-inspection";
import type { FormState } from "./actions";

type Item = {
  id: string;
  section: string;
  reference_code: string | null;
  item_name: string;
  result: string | null;
  defect_description: string | null;
  severity: string | null;
  safe_to_operate: boolean | null;
  photo_path: string | null;
};

type Meta = {
  service_done: boolean;
  service_notes: string | null;
  notes: string | null;
  signature_confirmed: boolean;
};

export function InspectionRunner({
  inspectionId,
  items: initialItems,
  meta: initialMeta,
  setResult,
  saveMeta,
  complete,
}: {
  inspectionId: string;
  items: Item[];
  meta: Meta;
  setResult: (
    resultId: string,
    patch: Record<string, unknown>,
  ) => Promise<FormState>;
  saveMeta: (patch: Record<string, unknown>) => Promise<FormState>;
  complete: (prev: FormState, fd: FormData) => Promise<FormState>;
}) {
  const [items, setItems] = useState(initialItems);
  const [meta, setMeta] = useState(initialMeta);
  const [busyPhoto, setBusyPhoto] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const sections = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of items) {
      const arr = map.get(it.section);
      if (arr) arr.push(it);
      else map.set(it.section, [it]);
    }
    return [...map.entries()];
  }, [items]);

  const done = items.filter((i) => i.result).length;
  const total = items.length;
  const allDone = done === total;

  const patchItem = (id: string, p: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));

  async function tap(it: Item, result: "ok" | "defect" | "na") {
    patchItem(it.id, {
      result,
      ...(result !== "defect"
        ? {
            defect_description: null,
            severity: null,
            safe_to_operate: null,
            photo_path: null,
          }
        : {}),
    });
    await setResult(it.id, { result });
  }

  const debounceSave = (key: string, fn: () => void) => {
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, 600);
  };

  async function uploadPhoto(it: Item, file: File) {
    setBusyPhoto(it.id);
    const supabase = createClient();
    const path = `${VI_PREFIX}/${inspectionId}/${crypto.randomUUID()}-${file.name.replace(
      /[^A-Za-z0-9._-]+/g,
      "_",
    )}`;
    const { error } = await supabase.storage
      .from(VI_BUCKET)
      .upload(path, file, { contentType: file.type || undefined });
    if (!error) {
      patchItem(it.id, { photo_path: path });
      await setResult(it.id, { photo_path: path });
    }
    setBusyPhoto(null);
  }

  const defects = items.filter((i) => i.result === "defect");
  const okCount = items.filter((i) => i.result === "ok").length;
  const naCount = items.filter((i) => i.result === "na").length;

  return (
    <div className="vi-runner">
      <div className="vi-progress">
        <strong>{done}</strong> / {total} checked
        <div className="vi-bar">
          <span style={{ width: `${(done / total) * 100}%` }} />
        </div>
      </div>

      {sections.map(([section, secItems]) => {
        const secDone = secItems.filter((i) => i.result).length;
        return (
          <section key={section} className="vi-section">
            <h2>
              {section.toUpperCase()}
              <span className="vi-sec-count">
                {secDone} / {secItems.length}
              </span>
            </h2>

            {secItems.map((it) => (
              <div
                key={it.id}
                className={`vi-item ${it.result ? "answered" : ""}`}
              >
                <div className="vi-item-name">
                  {it.reference_code && (
                    <span className="vi-ref">{it.reference_code}</span>
                  )}
                  {it.item_name}
                </div>
                <div className="vi-choices">
                  <button
                    type="button"
                    className={`vi-btn ok ${it.result === "ok" ? "on" : ""}`}
                    onClick={() => tap(it, "ok")}
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    className={`vi-btn defect ${it.result === "defect" ? "on" : ""}`}
                    onClick={() => tap(it, "defect")}
                  >
                    DEFECT
                  </button>
                  <button
                    type="button"
                    className={`vi-btn na ${it.result === "na" ? "on" : ""}`}
                    onClick={() => tap(it, "na")}
                  >
                    N/A
                  </button>
                </div>

                {it.result === "defect" && (
                  <div className="vi-defect">
                    <textarea
                      rows={2}
                      placeholder="What's the defect?"
                      defaultValue={it.defect_description ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        patchItem(it.id, { defect_description: v });
                        debounceSave(it.id, () =>
                          setResult(it.id, { defect_description: v }),
                        );
                      }}
                    />

                    <div className="vi-sev">
                      {VI_SEVERITIES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`vi-pill ${s} ${it.severity === s ? "on" : ""}`}
                          onClick={() => {
                            patchItem(it.id, { severity: s });
                            setResult(it.id, { severity: s });
                          }}
                        >
                          {VI_SEVERITY_LABELS[s]}
                        </button>
                      ))}
                    </div>

                    <div className="vi-safe">
                      <span>Safe to operate?</span>
                      <button
                        type="button"
                        className={`vi-pill yes ${it.safe_to_operate === true ? "on" : ""}`}
                        onClick={() => {
                          patchItem(it.id, { safe_to_operate: true });
                          setResult(it.id, { safe_to_operate: true });
                        }}
                      >
                        YES
                      </button>
                      <button
                        type="button"
                        className={`vi-pill no ${it.safe_to_operate === false ? "on" : ""}`}
                        onClick={() => {
                          patchItem(it.id, { safe_to_operate: false });
                          setResult(it.id, { safe_to_operate: false });
                        }}
                      >
                        NO
                      </button>
                    </div>

                    <label className="vi-photo">
                      {it.photo_path
                        ? "Photo added ✓ — replace"
                        : busyPhoto === it.id
                          ? "Uploading…"
                          : "Take / add photo"}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        hidden
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadPhoto(it, f);
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
            ))}
          </section>
        );
      })}

      {/* ---- finish ---- */}
      <section className="vi-section vi-finish">
        <h2>FINISH</h2>

        <div className="vi-summary">
          <div>
            <strong>{okCount}</strong> OK
          </div>
          <div>
            <strong>{naCount}</strong> N/A
          </div>
          <div className={defects.length ? "blocked" : undefined}>
            <strong>{defects.length}</strong> defect
            {defects.length === 1 ? "" : "s"}
          </div>
        </div>

        {defects.length > 0 && (
          <ul className="mr-items">
            {defects.map((d) => (
              <li key={d.id}>
                <span>
                  {d.reference_code ? `${d.reference_code} — ` : ""}
                  {d.item_name}
                  {d.severity
                    ? ` · ${VI_SEVERITY_LABELS[d.severity as keyof typeof VI_SEVERITY_LABELS] ?? d.severity}`
                    : ""}
                  {d.safe_to_operate === false ? " · NOT safe" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="field" style={{ marginTop: 12 }}>
          <label>Was a service carried out during this inspection?</label>
          <div className="yn">
            <button
              type="button"
              className={meta.service_done ? "chip on" : "chip"}
              onClick={() => {
                setMeta((m) => ({ ...m, service_done: true }));
                saveMeta({ service_done: true });
              }}
            >
              Yes
            </button>
            <button
              type="button"
              className={!meta.service_done ? "chip on" : "chip"}
              onClick={() => {
                setMeta((m) => ({ ...m, service_done: false }));
                saveMeta({ service_done: false, service_notes: null });
              }}
            >
              No
            </button>
          </div>
          {meta.service_done && (
            <textarea
              rows={2}
              placeholder="Service notes — oil & filters, etc."
              defaultValue={meta.service_notes ?? ""}
              style={{ marginTop: 8 }}
              onChange={(e) => {
                const v = e.target.value;
                setMeta((m) => ({ ...m, service_notes: v }));
                debounceSave("svc", () => saveMeta({ service_notes: v }));
              }}
            />
          )}
        </div>

        <div className="field">
          <label htmlFor="vi-notes">Notes (optional)</label>
          <textarea
            id="vi-notes"
            rows={2}
            defaultValue={meta.notes ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setMeta((m) => ({ ...m, notes: v }));
              debounceSave("notes", () => saveMeta({ notes: v }));
            }}
          />
        </div>

        <label className="signoff">
          <input
            type="checkbox"
            checked={meta.signature_confirmed}
            onChange={(e) => {
              setMeta((m) => ({ ...m, signature_confirmed: e.target.checked }));
              saveMeta({ signature_confirmed: e.target.checked });
            }}
          />
          <span>
            I confirm that I have completed the vehicle inspection and recorded
            all defects identified.
          </span>
        </label>

        <CompleteForm complete={complete} disabled={!allDone} remaining={total - done} />
      </section>
    </div>
  );
}

function CompleteForm({
  complete,
  disabled,
  remaining,
}: {
  complete: (prev: FormState, fd: FormData) => Promise<FormState>;
  disabled: boolean;
  remaining: number;
}) {
  const [state, setState] = useState<FormState>({});
  const [pending, setPending] = useState(false);
  return (
    <form
      action={async (fd) => {
        setPending(true);
        const res = await complete(state, fd);
        setState(res);
        setPending(false);
      }}
    >
      {state.error && <div className="error">{state.error}</div>}
      <button
        className="btn"
        type="submit"
        disabled={disabled || pending}
        style={{ fontSize: 17, padding: "14px 22px" }}
      >
        {pending ? "Completing…" : "Complete & sign inspection"}
      </button>
      {disabled && (
        <p className="field-hint" style={{ marginTop: 8 }}>
          {remaining} item{remaining === 1 ? "" : "s"} still to check.
        </p>
      )}
    </form>
  );
}
