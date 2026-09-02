import type { ReactNode } from "react";

export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required = false,
  hint,
  placeholder,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "decimal";
}) {
  return (
    <div className="field">
      <label htmlFor={name}>
        {label} {required && <span className="req">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        inputMode={inputMode}
        defaultValue={defaultValue ?? undefined}
      />
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  required = false,
  hint,
  placeholder = "—",
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string | null;
  required?: boolean;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>
        {label} {required && <span className="req">*</span>}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

export function TextAreaField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <textarea id={name} name={name} defaultValue={defaultValue ?? undefined} />
    </div>
  );
}

export function FormSection({
  title,
  children,
  single = false,
}: {
  title: string;
  children: ReactNode;
  single?: boolean;
}) {
  return (
    <div className="form-section">
      <h3>{title}</h3>
      <div className={single ? undefined : "form-grid"}>{children}</div>
    </div>
  );
}
