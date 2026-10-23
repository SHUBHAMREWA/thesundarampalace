/** wa.me click-to-chat link (works without any WhatsApp API or provider). */
export function whatsappLink(phoneE164: string, message?: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  const text = message?.trim() ? `?text=${encodeURIComponent(message.trim())}` : "";
  return `https://wa.me/${digits}${text}`;
}

export function telLink(phoneE164: string): string {
  return `tel:${phoneE164.replace(/[^\d+]/g, "")}`;
}

/** "+919876543210" → "+91 98765 43210" for display. */
export function formatPhoneForDisplay(phoneE164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(phoneE164);
  return m ? `+91 ${m[1]} ${m[2]}` : phoneE164;
}
