"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DOCUMENTS_BUCKET, MAX_DOCUMENT_BYTES } from "@/lib/documents";
import { reportBreakdown, type FormState } from "./actions";

type Vehicle = { id: string; label: string };

export function BreakdownForm({
  vehicles,
  defaultVehicle,
}: {
  vehicles: Vehicle[];
  defaultVehicle?: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    reportBreakdown,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locating, setLocating] = useState(false);

  function getLocation() {
    if (!navigator.geolocation) {
      setLocalError("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocalError("Couldn't get your location — you can leave it blank.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    const form = formRef.current!;
    const fileInput = form.elements.namedItem("photo") as HTMLInputElement;
    const file = fileInput.files?.[0];

    setBusy(true);
    let photoPath: string | null = null;
    if (file) {
      if (file.size > MAX_DOCUMENT_BYTES) {
        setBusy(false);
        return setLocalError("Photo is too large (15 MB max).");
      }
      const supabase = createClient();
      const path = `breakdowns/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (error) {
        setBusy(false);
        return setLocalError(`Photo upload failed: ${error.message}`);
      }
      photoPath = path;
    }

    const fd = new FormData(form);
    fd.delete("photo");
    if (photoPath) fd.set("photo_url", photoPath);
    if (coords) {
      fd.set("location_lat", String(coords.lat));
      fd.set("location_lng", String(coords.lng));
    }
    formAction(fd);
    setBusy(false);
  }

  const error = localError ?? state.error;

  return (
    <form ref={formRef} onSubmit={onSubmit}>
      {error && <div className="error">{error}</div>}

      <div className="field">
        <label htmlFor="vehicle_id">
          Vehicle <span className="req">*</span>
        </label>
        <select
          id="vehicle_id"
          name="vehicle_id"
          required
          defaultValue={defaultVehicle ?? ""}
        >
          <option value="">— Choose vehicle —</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="problem_description">
          What&apos;s wrong? <span className="req">*</span>
        </label>
        <textarea id="problem_description" name="problem_description" required />
      </div>

      <div className="field">
        <label>Can the vehicle still be driven?</label>
        <div className="choices" style={{ maxWidth: 320 }}>
          <label className="pass">
            <input
              type="radio"
              name="immobilised"
              value="no"
              defaultChecked
            />
            Yes, driveable
          </label>
          <label className="fail">
            <input type="radio" name="immobilised" value="yes" />
            No, stuck
          </label>
        </div>
      </div>

      <div className="field">
        <label htmlFor="photo">Photo (optional)</label>
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/*"
          capture="environment"
        />
      </div>

      <div className="field">
        <label>Location (optional)</label>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            className="btn ghost small"
            onClick={getLocation}
            disabled={locating}
          >
            {locating ? "Locating…" : "Use my location"}
          </button>
          {coords && (
            <span className="field-hint">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </span>
          )}
        </div>
      </div>

      <input type="hidden" name="photo_url" />
      <input type="hidden" name="location_lat" />
      <input type="hidden" name="location_lng" />

      <div className="btn-row">
        <button className="btn danger" type="submit" disabled={busy}>
          {busy ? "Sending…" : "Report breakdown"}
        </button>
        <Link className="btn ghost" href="/dashboard">
          Cancel
        </Link>
      </div>
    </form>
  );
}
