"use client";

export function VoidControl({
  action,
  voided,
  noun,
}: {
  action: () => Promise<void>;
  voided: boolean;
  noun: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const msg = voided
          ? `Restore this ${noun}? It will be active again.`
          : `Void this ${noun}? It stays in the database and history for audit, but is hidden from the active list.`;
        if (!confirm(msg)) e.preventDefault();
      }}
    >
      <button className={voided ? "btn ghost" : "btn danger"} type="submit">
        {voided ? "Restore record" : "Void record"}
      </button>
    </form>
  );
}
