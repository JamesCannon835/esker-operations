"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Finger / mouse signature pad. The trimmed PNG data URL is kept in a hidden
 * <input name="signature"> that the server action reads on submit.
 */
export function SignaturePad({
  action,
}: {
  action: (fd: FormData) => void | Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const [drawn, setDrawn] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1b1a18";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setDrawn(true);
  }
  function end() {
    if (drawing.current && hiddenRef.current && canvasRef.current) {
      hiddenRef.current.value = canvasRef.current.toDataURL("image/png");
    }
    drawing.current = false;
    last.current = null;
  }
  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    if (hiddenRef.current) hiddenRef.current.value = "";
    setDrawn(false);
  }

  return (
    <form action={action} className="tb-sign">
      <input ref={hiddenRef} type="hidden" name="signature" />
      <p className="hint">
        Sign below to confirm you have read and understood this toolbox talk.
      </p>
      <canvas
        ref={canvasRef}
        className="tb-canvas"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="tb-sign-row">
        <button type="button" className="btn ghost small" onClick={clear}>
          Clear
        </button>
        <label className="tb-confirm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />{" "}
          I have read and understood this toolbox talk
        </label>
      </div>
      <button type="submit" className="btn" disabled={!drawn || !confirmed}>
        Submit signature
      </button>
    </form>
  );
}
