"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DOC_BUCKET, DOC_MAX_BYTES, DOC_ACCEPT } from "@/lib/doc-library";

function sanitise(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120) || "file";
}

export function Upload({
  prefix,
  folderId,
  register,
}: {
  prefix: string;
  folderId: string | null;
  register: (file: {
    path: string;
    name: string;
    size: number;
    type: string | null;
  }) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setErr(null);
    const supabase = createClient();
    let done = 0;
    for (const file of files) {
      done++;
      setBusy(`${done}/${files.length}`);
      if (file.size > DOC_MAX_BYTES) {
        setErr(`${file.name} is over 40 MB — skipped`);
        continue;
      }
      const key = `${prefix}/${folderId ?? "root"}/${crypto.randomUUID()}-${sanitise(
        file.name,
      )}`;
      const { error } = await supabase.storage
        .from(DOC_BUCKET)
        .upload(key, file, { contentType: file.type || undefined });
      if (error) {
        setErr(`${file.name}: ${error.message}`);
        continue;
      }
      await register({
        path: key,
        name: file.name,
        size: file.size,
        type: file.type || null,
      });
    }
    setBusy(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <span>
      <button
        type="button"
        className="btn small"
        disabled={!!busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? `Uploading ${busy}…` : "Upload / scan"}
      </button>
      {/* No `capture` — the mobile file picker still offers Camera / Scan
          Documents, and this keeps "choose existing files" working too. */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={DOC_ACCEPT}
        hidden
        onChange={onChange}
      />
      {err && (
        <div className="error" style={{ marginTop: 8 }}>
          {err}
        </div>
      )}
    </span>
  );
}
