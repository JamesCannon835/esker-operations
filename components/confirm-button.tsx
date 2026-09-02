"use client";

export function ConfirmButton({
  action,
  label,
  confirmText,
  className = "btn",
}: {
  action: () => Promise<void>;
  label: string;
  confirmText?: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirmText && !confirm(confirmText)) e.preventDefault();
      }}
    >
      <button className={className} type="submit">
        {label}
      </button>
    </form>
  );
}
