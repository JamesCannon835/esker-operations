"use client";

import { useActionState, useState } from "react";
import type { FormState } from "./actions";

type Target = { id: string; label: string };

export function ItemActions({
  kind,
  name,
  moveTargets,
  currentTarget,
  rename,
  move,
  remove,
}: {
  kind: "folder" | "doc";
  name: string;
  moveTargets: Target[];
  currentTarget: string | null;
  rename: (prev: FormState, fd: FormData) => Promise<FormState>;
  move: (prev: FormState, fd: FormData) => Promise<FormState>;
  remove: () => Promise<void>;
}) {
  const [open, setOpen] = useState<null | "rename" | "move">(null);
  const [renameState, renameAction, renaming] = useActionState<
    FormState,
    FormData
  >(rename, {});
  const [moveState, moveAction, moving] = useActionState<FormState, FormData>(
    move,
    {},
  );

  return (
    <details className="hs-menu">
      <summary aria-label="Actions">⋯</summary>
      <div className="hs-menu-panel">
        {open === "rename" ? (
          <form action={renameAction} className="hs-menu-form">
            <input name="name" defaultValue={name} autoFocus />
            <button className="btn small" type="submit" disabled={renaming}>
              Save
            </button>
            {renameState.error && (
              <span className="error">{renameState.error}</span>
            )}
          </form>
        ) : open === "move" ? (
          <form action={moveAction} className="hs-menu-form">
            <select name="target" defaultValue={currentTarget ?? ""}>
              <option value="">Top level</option>
              {moveTargets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <button className="btn small" type="submit" disabled={moving}>
              Move here
            </button>
            {moveState.error && (
              <span className="error">{moveState.error}</span>
            )}
          </form>
        ) : (
          <div className="hs-menu-actions">
            <button type="button" onClick={() => setOpen("rename")}>
              Rename
            </button>
            <button type="button" onClick={() => setOpen("move")}>
              Move
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                if (
                  confirm(
                    kind === "folder"
                      ? `Delete the folder "${name}" and everything in it?`
                      : `Delete "${name}"?`,
                  )
                ) {
                  remove();
                }
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
