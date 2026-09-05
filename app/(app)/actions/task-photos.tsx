"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TASK_BUCKET, TASK_PREFIX, TASK_MAX_BYTES } from "@/lib/tasks";

function sanitize(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80) || "photo";
}

type Uploaded = { path: string; name: string; type: string | null };

/**
 * Uploads photos to Storage straight away. Two modes:
 *  - `register` given  → tells the server to attach each one (task detail page)
 *  - no `register`     → keeps hidden inputs so a parent <form> saves them (new task)
 */
export function TaskPhotos({
  actionId,
  register,
}: {
  actionId: string;
  register?: (a: Uploaded) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<Uploaded[]>([]);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    for (const file of files) {
      if (file.size > TASK_MAX_BYTES) {
        setErr(`${file.name} is over 20 MB — skipped`);
        continue;
      }
      const path = `${TASK_PREFIX}/${actionId}/${crypto.randomUUID()}-${sanitize(
        file.name,
      )}`;
      const { error } = await supabase.storage
        .from(TASK_BUCKET)
        .upload(path, file, { contentType: file.type || undefined });
      if (error) {
        setErr(`Upload failed: ${error.message}`);
        continue;
      }
      const item = { path, name: file.name, type: file.type || null };
      if (register) await register(item);
      else setPending((p) => [...p, item]);
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <button
        type="button"
        className="btn ghost small"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Uploading…" : "📷 Add photo"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={onChange}
      />
      {err && (
        <div className="blocked" style={{ marginTop: 6 }}>
          {err}
        </div>
      )}
      {!register && pending.length > 0 && (
        <p className="hint" style={{ marginTop: 6 }}>
          {pending.length} photo{pending.length === 1 ? "" : "s"} attached
        </p>
      )}
      {!register &&
        pending.map((p, i) => (
          <span key={i}>
            <input type="hidden" name="photo_path" value={p.path} />
            <input type="hidden" name="photo_name" value={p.name} />
            <input type="hidden" name="photo_type" value={p.type ?? ""} />
          </span>
        ))}
    </div>
  );
}
