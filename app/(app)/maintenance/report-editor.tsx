"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  MR_REASONS,
  MR_REASON_LABELS,
  MR_VEHICLE_STATUS,
  MR_VEHICLE_STATUS_LABELS,
  MR_OUT_OF_SERVICE,
  ACTION_PRIORITIES,
  ACTION_PRIORITY_LABELS,
  type MrVehicleStatus,
} from "@/lib/maintenance";
import type { FormState } from "./actions";

type Person = { id: string; full_name: string };

export type ReportFields = {
  report_time: string | null;
  mileage: number | null;
  engine_hours: number | null;
  reasons: string[];
  issue_description: string | null;
  work_summary: string | null;
  notes: string | null;
  vehicle_status: string | null;
  signature_confirmed: boolean;
  followup_required: boolean;
  followup_detail: string | null;
  followup_priority: string | null;
  followup_assigned_to: string | null;
  followup_due_date: string | null;
};

export function ReportEditor({
  fields,
  people,
  showEngineHours,
  save,
  children,
}: {
  fields: ReportFields;
  people: Person[];
  showEngineHours: boolean;
  save: (patch: Record<string, unknown>) => Promise<FormState>;
  children?: ReactNode;
}) {
  const [f, setF] = useState<ReportFields>(fields);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Record<string, unknown>>({});

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const patch = pending.current;
    if (Object.keys(patch).length === 0) return;
    pending.current = {};
    setSaving("saving");
    const res = await save(patch);
    setSaving(res.error ? "error" : "saved");
    if (!res.error) setTimeout(() => setSaving("idle"), 1500);
  }, [save]);

  const push = useCallback(
    (patch: Partial<ReportFields>) => {
      setF((prev) => ({ ...prev, ...patch }));
      Object.assign(pending.current, patch);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 600);
    },
    [flush],
  );

  const toggleReason = (r: string) => {
    const next = f.reasons.includes(r)
      ? f.reasons.filter((x) => x !== r)
      : [...f.reasons, r];
    push({ reasons: next });
  };

  const oosPicked =
    f.vehicle_status &&
    MR_OUT_OF_SERVICE.includes(f.vehicle_status as MrVehicleStatus);

  return (
    <div className="report-editor">
      <div className="save-flag" aria-live="polite">
        {saving === "saving" && "Saving…"}
        {saving === "saved" && "Saved ✓"}
        {saving === "error" && (
          <span className="blocked">Not saved — check your connection</span>
        )}
      </div>

      {/* --- vehicle detail bits --- */}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="mileage">Current mileage (km)</label>
          <input
            id="mileage"
            type="number"
            inputMode="numeric"
            defaultValue={f.mileage ?? ""}
            onBlur={(e) =>
              push({ mileage: e.target.value ? Number(e.target.value) : null })
            }

          />
        </div>
        {showEngineHours && (
          <div className="field">
            <label htmlFor="engine_hours">Engine hours</label>
            <input
              id="engine_hours"
              type="number"
              inputMode="numeric"
              defaultValue={f.engine_hours ?? ""}
              onBlur={(e) =>
                push({
                  engine_hours: e.target.value ? Number(e.target.value) : null,
                })
              }

            />
          </div>
        )}
        <div className="field">
          <label htmlFor="report_time">Time</label>
          <input
            id="report_time"
            type="time"
            defaultValue={f.report_time ?? ""}
            onBlur={(e) => push({ report_time: e.target.value || null })}

          />
        </div>
      </div>

      {/* --- reasons --- */}
      <h3 className="sec">Reason for maintenance</h3>
      <div className="chips">
        {MR_REASONS.map((r) => (
          <label key={r} className={f.reasons.includes(r) ? "chip on" : "chip"}>
            <input
              type="checkbox"
              checked={f.reasons.includes(r)}
              onChange={() => toggleReason(r)}
            />
            {MR_REASON_LABELS[r]}
          </label>
        ))}
      </div>

      {/* --- issue --- */}
      <h3 className="sec">Fault / issue reported</h3>
      <textarea
        className="big"
        rows={3}
        defaultValue={f.issue_description ?? ""}
        placeholder="What was reported, plus anything you found on inspection…"
        onBlur={(e) => push({ issue_description: e.target.value || null })}

      />

      {/* --- work carried out --- */}
      <h3 className="sec">Work carried out</h3>
      <textarea
        className="big"
        rows={5}
        defaultValue={f.work_summary ?? ""}
        placeholder="Describe all repairs and maintenance completed. Add individual jobs below."
        onBlur={(e) => push({ work_summary: e.target.value || null })}

      />

      {/* work items / parts / labour, rendered by the page */}
      {children}

      {/* --- notes --- */}
      <h3 className="sec">Notes / additional observations</h3>
      <textarea
        className="big"
        rows={3}
        defaultValue={f.notes ?? ""}
        placeholder="Tyres approaching replacement · slight oil leak, monitor · due service shortly…"
        onBlur={(e) => push({ notes: e.target.value || null })}

      />

      {/* --- follow-up --- */}
      <h3 className="sec">Follow-up work required?</h3>
      <div className="yn">
        <label className={f.followup_required ? "chip on" : "chip"}>
          <input
            type="radio"
            name="fu"
            checked={f.followup_required}
            onChange={() => push({ followup_required: true })}
          />
          Yes
        </label>
        <label className={!f.followup_required ? "chip on" : "chip"}>
          <input
            type="radio"
            name="fu"
            checked={!f.followup_required}
            onChange={() =>
              push({ followup_required: false, followup_detail: null })
            }
          />
          No
        </label>
      </div>

      {f.followup_required && (
        <div className="fu-detail">
          <div className="field">
            <label htmlFor="fu_detail">Follow-up description</label>
            <textarea
              id="fu_detail"
              rows={2}
              defaultValue={f.followup_detail ?? ""}
              onBlur={(e) => push({ followup_detail: e.target.value || null })}

            />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="fu_priority">Priority</label>
              <select
                id="fu_priority"
                value={f.followup_priority ?? "normal"}
                onChange={(e) => push({ followup_priority: e.target.value })}
              >
                {ACTION_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {ACTION_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fu_who">Responsible person</label>
              <select
                id="fu_who"
                value={f.followup_assigned_to ?? ""}
                onChange={(e) =>
                  push({ followup_assigned_to: e.target.value || null })
                }
              >
                <option value="">— Choose —</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fu_due">Target completion date</label>
              <input
                id="fu_due"
                type="date"
                defaultValue={f.followup_due_date ?? ""}
                onBlur={(e) =>
                  push({ followup_due_date: e.target.value || null })
                }

              />
            </div>
          </div>
        </div>
      )}

      {/* --- vehicle status --- */}
      <h3 className="sec">Vehicle status after repair</h3>
      <div className="status-list">
        {MR_VEHICLE_STATUS.map((s) => (
          <label
            key={s}
            className={
              f.vehicle_status === s
                ? MR_OUT_OF_SERVICE.includes(s)
                  ? "status on danger"
                  : "status on"
                : "status"
            }
          >
            <input
              type="radio"
              name="vstatus"
              checked={f.vehicle_status === s}
              onChange={() => push({ vehicle_status: s })}
            />
            {MR_VEHICLE_STATUS_LABELS[s]}
          </label>
        ))}
      </div>
      {oosPicked && (
        <div className="voided-banner" style={{ marginTop: 10 }}>
          Vehicle will be marked <strong>OUT OF SERVICE</strong> when this report
          is completed.
        </div>
      )}

      {/* --- sign off --- */}
      <h3 className="sec">Sign-off</h3>
      <label className="signoff">
        <input
          type="checkbox"
          checked={f.signature_confirmed}
          onChange={(e) => push({ signature_confirmed: e.target.checked })}
        />
        <span>
          I confirm that the work recorded above accurately represents the
          maintenance and repairs carried out.
        </span>
      </label>
    </div>
  );
}
