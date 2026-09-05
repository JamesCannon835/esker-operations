"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A textarea with a "talk into it" button (browser speech-to-text where
 * available — Chrome / Android). Where it isn't (iOS Safari), the button is
 * hidden and the phone keyboard's own mic still works.
 */
export function MicTextarea({
  name,
  defaultValue = "",
  rows = 3,
  placeholder,
  id,
  required,
}: {
  name: string;
  defaultValue?: string;
  rows?: number;
  placeholder?: string;
  id?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<any>(null);
  const baseRef = useRef("");

  useEffect(() => {
    const SR =
      (typeof window !== "undefined" &&
        ((window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition)) ||
      null;
    if (!SR) return;
    setSupported(true);
    const rec = new SR();
    rec.lang = "en-IE";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      const sep = baseRef.current && !baseRef.current.endsWith(" ") ? " " : "";
      setValue((baseRef.current + sep + text).trimStart());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    };
  }, []);

  function toggle() {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
      return;
    }
    baseRef.current = value;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  return (
    <div className="mic-wrap">
      <textarea
        id={id}
        name={name}
        rows={rows}
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {supported && (
        <button
          type="button"
          className={`mic-btn${listening ? " on" : ""}`}
          onClick={toggle}
          aria-label={listening ? "Stop dictation" : "Talk to fill this in"}
        >
          {listening ? "● Listening — tap to stop" : "🎤 Talk"}
        </button>
      )}
    </div>
  );
}
