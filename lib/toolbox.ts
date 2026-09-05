export const TOOLBOX_SIG_MAX_BYTES = 200 * 1024; // generous ceiling for a PNG data URL

export type ToolboxTalk = {
  id: string;
  title: string;
  talk_date: string;
  body: string | null;
  document_id: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  status: "draft" | "sent";
  sent_at: string | null;
  created_at: string;
};

export type ToolboxRecipient = {
  id: string;
  talk_id: string;
  user_id: string;
  signed_at: string | null;
  signature_data: string | null;
};

/** Basic shape check on the signature data URL coming from the canvas. */
export function isValidSignature(v: string | null | undefined): v is string {
  return (
    typeof v === "string" &&
    v.startsWith("data:image/png;base64,") &&
    v.length > 200 &&
    v.length < TOOLBOX_SIG_MAX_BYTES * 1.4
  );
}
