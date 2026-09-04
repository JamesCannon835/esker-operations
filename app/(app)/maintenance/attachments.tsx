"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  MAINTENANCE_BUCKET,
  MAINTENANCE_PREFIX,
  MR_ATTACHMENT_KINDS,
  MR_ATTACHMENT_KIND_LABELS,
} from "@/lib/maintenance";

const MAX = 20 * 1024 * 1024;

function sanitize(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80) || "file";
}

export function AttachmentUpload({
  reportId,
  register,
}: {
  reportId: string;
  register: (a: { path: string; name: string; kind: string }) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<string>("after");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    for (const file of Array.from(files)) {
      if (file.size > MAX) {
        setErr(`Skipped ${file.name} — over 20 MB`);
        continue;
      }
      const path = `${MAINTENANCE_PREFIX}/${reportId}/${crypto.randomUUID()}-${sanitize(
        file.name,
      )}`;
      const { error } = await supabase.storage
        .from(MAINTENANCE_BUCKET)
        .upload(path, file, { contentType: file.type || undefined });
      if (error) {
        setErr(`Upload failed: ${error.message}`);
        continue;
      }
      await register({ path, name: file.name, kind });
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="mr-add">
      <select value={kind} onChange={(e) => setKind(e.target.value)}>
        {MR_ATTACHMENT_KINDS.map((k) => (
          <option key={k} value={k}>
            {MR_ATTACHMENT_KIND_LABELS[k]}
          </option>
        ))}
      </select>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf,.heic"
        multiple
        capture="environment"
        onChange={onChange}
        disabled={busy}
      />
      {busy && <span className="hint">Uploading…</span>}
      {err && <span className="blocked">{err}</span>}
    </div>
  );
}
