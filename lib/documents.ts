export const DOCUMENT_CATEGORIES = [
  "registration",
  "insurance",
  "test_cert",
  "service_record",
  "manual",
  "invoice",
  "other",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  registration: "Registration",
  insurance: "Insurance",
  test_cert: "Test certificate",
  service_record: "Service record",
  manual: "Manual",
  invoice: "Invoice",
  other: "Other",
};

export const DOCUMENTS_BUCKET = "documents";
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024; // 15 MB
export const ACCEPTED_DOC_TYPES =
  ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx";
