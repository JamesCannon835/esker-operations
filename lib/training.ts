import { complianceStatus, type ComplianceStatus } from "@/lib/compliance";

export const TRAINING_BUCKET = "documents";
export const TRAINING_PREFIX = "training";
export const MAX_CERT_BYTES = 15 * 1024 * 1024; // 15 MB
export const ACCEPTED_CERT_TYPES =
  ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx";

export type TrainingRecord = {
  id: string;
  user_id: string;
  course_id: string | null;
  course_name: string;
  completed_date: string;
  expiry_date: string | null;
  certificate_path: string | null;
  certificate_name: string | null;
  notes: string | null;
  voided: boolean;
};

export type TrainingCourse = {
  id: string;
  name: string;
  active: boolean;
};

/**
 * Status of a training record:
 *   - no expiry date  -> "green" (valid, doesn't lapse)
 *   - has expiry date -> same red / amber / green as vehicle compliance
 */
export function trainingStatus(
  expiryDate: string | null,
): ComplianceStatus {
  if (!expiryDate) return "green";
  return complianceStatus(expiryDate);
}
