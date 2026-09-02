"use client";

export function DeleteTemplateButton({
  action,
}: {
  action: () => Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Delete this checklist? This cannot be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <button className="btn danger" type="submit">
        Delete checklist
      </button>
    </form>
  );
}
