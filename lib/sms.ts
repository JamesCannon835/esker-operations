// SMS sending. No provider is wired yet — set SMS_PROVIDER (+ its keys) in
// the environment and fill in the branch below when a service is chosen
// (Twilio, ClickSend, Text Marketer, …). Everything else in the blast
// notification module works without it; "Send" stays blocked until this
// returns configured.

export type SmsResult = { ok: boolean; ref?: string; error?: string };

export function smsConfigured(): boolean {
  return Boolean(process.env.SMS_PROVIDER);
}

/** Normalise an Irish-style number to E.164 (+353…). Best effort. */
export function normalisePhone(raw: string): string {
  let s = raw.replace(/[^\d+]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("+")) return s;
  if (s.startsWith("0")) return "+353" + s.slice(1);
  if (s.startsWith("353")) return "+" + s;
  return s;
}

export async function sendSms(
  to: string,
  body: string,
): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER;
  if (!provider) return { ok: false, error: "No texting service connected" };

  const number = normalisePhone(to);

  // switch (provider) {
  //   case "twilio": { ... }
  //   case "clicksend": { ... }
  // }
  void number;
  void body;
  return { ok: false, error: `SMS provider "${provider}" is not implemented yet` };
}
