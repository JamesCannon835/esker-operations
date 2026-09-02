"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { AssetOption } from "@/lib/asset-picker";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENTS_BUCKET,
  MAX_DOCUMENT_BYTES,
  ACCEPTED_DOC_TYPES,
} from "@/lib/documents";
import { registerDocument, type FormState } from "./actions";

function sanitize(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80) || "file";
}

export function UploadForm({
  assets,
  defaultAsset,
}: {
  assets: AssetOption[];
  defaultAsset?: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    registerDocument,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const groups = [...new Set(assets.map((a) => a.group))];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    const form = formRef.current!;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return setLocalError("Choose a file to upload.");
    if (file.size > MAX_DOCUMENT_BYTES)
      return setLocalError("That file is over the 15 MB limit.");

    setBusy(true);
    const supabase = createClient();
    const path = `${crypto.randomUUID()}/${sanitize(file.name)}`;
    const { error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, file, { contentType: file.type || undefined });

    if (error) {
      setBusy(false);
      setLocalError(
        `Upload failed: ${error.message}. Is the "documents" storage bucket set up?`,
      );
      return;
    }

    const fd = new FormData(form);
    fd.set("storage_path", path);
    fd.delete("file");
    formAction(fd);
    setBusy(false);
  }

  const error = localError ?? state.error;

  return (
    <form ref={formRef} onSubmit={onSubmit}>
      {error && <div className="error">{error}</div>}

      <div className="field">
        <label htmlFor="file">
          File <span className="req">*</span>
        </label>
        <input id="file" name="file" type="file" accept={ACCEPTED_DOC_TYPES} />
        <div className="field-hint">PDF, image or Office file, up to 15 MB.</div>
      </div>

      <div className="field">
        <label htmlFor="asset">
          Asset <span className="req">*</span>
        </label>
        <select id="asset" name="asset" required defaultValue={defaultAsset ?? ""}>
          <option value="">— Choose asset —</option>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {assets
                .filter((a) => a.group === g)
                .map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue="other">
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {DOCUMENT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="expiry_date">Expiry date (optional)</label>
          <input id="expiry_date" name="expiry_date" type="date" />
        </div>
      </div>

      <input type="hidden" name="storage_path" />

      <div className="btn-row">
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Uploading…" : "Upload document"}
        </button>
        <Link className="btn ghost" href="/documents">
          Cancel
        </Link>
      </div>
    </form>
  );
}
