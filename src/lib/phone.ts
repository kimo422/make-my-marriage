// Phone numbers are stored in E.164 (+919876543210). India (+91) is assumed
// when no country code is given (Database Design, "Phone numbers"). Client-safe.

const E164 = /^\+[1-9]\d{7,14}$/;

/** Normalises common Indian ways of writing a number; returns null if it can't be a phone number. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (hasPlus) return E164.test(`+${digits}`) ? `+${digits}` : null;
  if (digits.startsWith("00"))
    digits = digits.slice(2); // 0091… international prefix
  else if (digits.length === 11 && digits.startsWith("0"))
    digits = `91${digits.slice(1)}`; // 098…
  else if (digits.length === 10) digits = `91${digits}`; // 98…
  const e164 = `+${digits}`;
  return E164.test(e164) ? e164 : null;
}

/** "+91 98765 43210" for Indian numbers; other countries stay compact. */
export function formatPhone(e164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1] ?? ""} ${m[2] ?? ""}` : e164;
}

/** Digits only, as wa.me links want them. */
export function whatsappNumber(e164: string): string {
  return e164.replace(/\D/g, "");
}
