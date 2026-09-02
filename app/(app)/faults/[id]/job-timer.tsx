"use client";

import { useEffect, useState } from "react";
import { LABOUR_TYPES, LABOUR_TYPE_LABELS } from "@/lib/inspections";

type Running = { id: string; start_time: string; entry_type: string };

function hms(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export function JobTimer({
  running,
  startAction,
  stopAction,
}: {
  running: Running | null;
  startAction: (fd: FormData) => Promise<void>;
  stopAction?: () => Promise<void>;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  if (running) {
    const elapsed = now - new Date(running.start_time).getTime();
    return (
      <div className="timer-box">
        <div>
          <span className="timer-clock">{hms(elapsed)}</span>{" "}
          <span className="badge">
            {LABOUR_TYPE_LABELS[
              running.entry_type as keyof typeof LABOUR_TYPE_LABELS
            ] ?? running.entry_type}
          </span>
        </div>
        <form action={stopAction}>
          <button className="btn" type="submit">
            Stop timer
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={startAction} className="timer-box">
      <select name="entry_type" defaultValue="repair">
        {LABOUR_TYPES.map((t) => (
          <option key={t} value={t}>
            {LABOUR_TYPE_LABELS[t]}
          </option>
        ))}
      </select>
      <button className="btn" type="submit">
        Start timer
      </button>
    </form>
  );
}
