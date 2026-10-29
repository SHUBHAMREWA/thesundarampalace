import { whatsappLink } from "./links";

/**
 * Pre-approved WhatsApp message templates (MASTER_PROMPT §20).
 *
 * WhatsApp messages are rendered into wa.me links for direct, zero-cost staff
 * communication, or dispatched through an API adapter when one is configured.
 */

export const WhatsAppTemplates = {
  /** Sent when a formal quotation has been issued */
  quotationSent: (p: { customerName: string; bookingRef: string; validUntil: string; link?: string }) =>
    `Namaste ${p.customerName}, your event quotation for booking ${p.bookingRef} has been prepared by The Sundaram Palace. This proposal is valid until ${p.validUntil}.${p.link ? ` You can view your quotation here: ${p.link}` : ""} Please let us know if you would like to discuss any adjustments.`,

  /** Sent before an instalment due date */
  paymentDue: (p: { customerName: string; bookingRef: string; amountINR: string; dueDate: string }) =>
    `Namaste ${p.customerName}, this is a gentle reminder from The Sundaram Palace regarding booking ${p.bookingRef}. An instalment of ₹${p.amountINR} is due on ${p.dueDate}. For any assistance with payment details, please feel free to reply directly to this chat.`,

  /** Sent immediately after recording a payment or deposit */
  paymentReceived: (p: { customerName: string; bookingRef: string; amountINR: string; receiptNumber: string }) =>
    `Namaste ${p.customerName}, we have received your payment of ₹${p.amountINR} for booking ${p.bookingRef}. Your official receipt number is ${p.receiptNumber}. Thank you for choosing The Sundaram Palace.`,

  /** Sent to remind the host 2 days before the celebration */
  eventReminder: (p: { customerName: string; mainEventName: string; eventDate: string; hallName: string }) =>
    `Namaste ${p.customerName}, The Sundaram Palace team is excited to host "${p.mainEventName}" on ${p.eventDate} at ${p.hallName}. Our operations staff is fully prepared. Should you have any last-minute questions, please contact us here.`,

  /** Sent following event completion for feedback & Google review */
  feedbackRequest: (p: { customerName: string; reviewLink?: string }) =>
    `Namaste ${p.customerName}, congratulations on your wonderful celebration at The Sundaram Palace! It was our utmost privilege to host your family. If you enjoyed our hospitality, we would be deeply grateful if you could share a few words on our Google profile: ${p.reviewLink ?? "https://g.page/review"}. Wishing you joy and prosperity!`,

  /** Sent when a customer schedules a site visit */
  siteVisitConfirmation: (p: { customerName: string; visitDate: string; timeSlot: string }) =>
    `Namaste ${p.customerName}, your in-person visit to The Sundaram Palace is confirmed for ${p.visitDate} (${p.timeSlot}). Our venue manager looks forward to welcoming you. Location directions: https://maps.google.com/?q=The+Sundaram+Palace.`,
};

/** Builds an instant click-to-chat URL for any template */
export function buildWhatsAppChatUrl<T extends keyof typeof WhatsAppTemplates>(
  phoneE164: string,
  templateName: T,
  params: Parameters<(typeof WhatsAppTemplates)[T]>[0],
): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const text = (WhatsAppTemplates[templateName] as any)(params);
  return whatsappLink(phoneE164, text);
}
