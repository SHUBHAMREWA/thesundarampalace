import "server-only";

import type { ActiveWhatsApp, MetaCredentials, TwilioCredentials } from "./config";

/**
 * Provider adapters: Meta WhatsApp Cloud API (direct) and Twilio. Both send
 * pre-approved templates only, because business-initiated WhatsApp messages
 * must use templates. Swap or add providers here; the rest of the app only
 * sees these four functions.
 */

/** Graph API version; Meta supports each version for about two years. */
const GRAPH = "https://graph.facebook.com/v23.0";
const TIMEOUT = 15_000;

export type ConnectionTest = { ok: true; detail: string } | { ok: false; detail: string };

export type WhatsAppTemplate = {
  /** Stable id for forms: "<name>|<ref>". */
  key: string;
  name: string;
  /** Meta: language code. Twilio: Content SID (HX…). */
  ref: string;
  language: string;
  category: string;
  body: string;
  variableCount: number;
  /** Why the app can't send this template, if it can't. */
  unsupported: string | null;
};

export type SendResult =
  | { status: "SENT"; providerMessageId: string }
  | { status: "FAILED"; error: string; permanent: boolean };

export function countVariables(body: string): number {
  let max = 0;
  for (const match of body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) max = Math.max(max, Number(match[1]));
  return max;
}

/** Fills {{1}}, {{2}}, … for the message log. */
export function fillTemplate(body: string, values: string[]): string {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (all, n: string) => values[Number(n) - 1] ?? all);
}

function failure(error: unknown): string {
  if (error instanceof Error) return error.name === "TimeoutError" ? "The provider did not answer in time" : error.message;
  return "Unknown error";
}

// ─── Meta WhatsApp Cloud API ─────────────────────────────────────────────────

type MetaError = { error?: { message?: string; code?: number; error_user_msg?: string } };

async function metaFetch<T>(creds: MetaCredentials, path: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const response = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${creds.accessToken}`, "Content-Type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  });
  const json = (await response.json().catch(() => ({}))) as T & MetaError;
  if (!response.ok) {
    const e = json.error;
    return { ok: false, status: response.status, error: `${e?.error_user_msg || e?.message || `Meta responded ${response.status}`}${e?.code ? ` (code ${e.code})` : ""}` };
  }
  return { ok: true, data: json };
}

async function metaTest(creds: MetaCredentials): Promise<ConnectionTest> {
  const phone = await metaFetch<{ display_phone_number?: string; verified_name?: string; quality_rating?: string }>(
    creds,
    `/${encodeURIComponent(creds.phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating`,
  );
  if (!phone.ok) return { ok: false, detail: `Phone number ID or access token is wrong: ${phone.error}` };
  const templates = await metaFetch<{ data?: unknown[] }>(creds, `/${encodeURIComponent(creds.wabaId)}/message_templates?limit=1&fields=name`);
  if (!templates.ok) return { ok: false, detail: `WhatsApp Business Account ID is wrong or the token can't read it: ${templates.error}` };
  const p = phone.data;
  const warning = creds.appSecret ? "" : " Add the App secret so delivery updates can be checked.";
  return { ok: true, detail: `Connected to ${p.verified_name ?? "WhatsApp"} (${p.display_phone_number ?? creds.phoneNumberId})${p.quality_rating ? `, quality ${p.quality_rating}` : ""}.${warning}` };
}

type MetaTemplate = {
  name: string;
  language: string;
  status: string;
  category: string;
  parameter_format?: string;
  components?: { type: string; format?: string; text?: string; buttons?: { type: string; url?: string }[] }[];
};

async function metaTemplates(creds: MetaCredentials): Promise<WhatsAppTemplate[]> {
  const result = await metaFetch<{ data?: MetaTemplate[] }>(
    creds,
    `/${encodeURIComponent(creds.wabaId)}/message_templates?limit=200&fields=name,language,status,category,parameter_format,components`,
  );
  if (!result.ok) throw new Error(result.error);
  return (result.data.data ?? [])
    .filter((t) => t.status === "APPROVED")
    .map((t) => {
      const body = t.components?.find((c) => c.type === "BODY")?.text ?? "";
      const header = t.components?.find((c) => c.type === "HEADER");
      const urlButtonVar = t.components?.some((c) => c.type === "BUTTONS" && c.buttons?.some((b) => b.type === "URL" && /\{\{/.test(b.url ?? "")));
      const unsupported =
        t.parameter_format === "NAMED"
          ? "Uses named variables; use {{1}}, {{2}} style"
          : header && header.format && header.format !== "TEXT"
            ? "Has an image/video/document header"
            : header?.text && /\{\{/.test(header.text)
              ? "Has a variable in the header"
              : urlButtonVar
                ? "Has a variable in a button link"
                : null;
      return { key: `${t.name}|${t.language}`, name: t.name, ref: t.language, language: t.language, category: t.category, body, variableCount: countVariables(body), unsupported };
    });
}

async function metaSend(creds: MetaCredentials, to: string, template: { name: string; ref: string }, variables: string[]): Promise<SendResult> {
  try {
    const result = await metaFetch<{ messages?: { id: string }[] }>(creds, `/${encodeURIComponent(creds.phoneNumberId)}/messages`, {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/^\+/, ""),
        type: "template",
        template: {
          name: template.name,
          language: { code: template.ref },
          ...(variables.length ? { components: [{ type: "body", parameters: variables.map((text) => ({ type: "text", text })) }] } : {}),
        },
      }),
    });
    if (!result.ok) return { status: "FAILED", error: result.error, permanent: result.status >= 400 && result.status < 500 && result.status !== 429 };
    const id = result.data.messages?.[0]?.id;
    return id ? { status: "SENT", providerMessageId: id } : { status: "FAILED", error: "Meta did not return a message id", permanent: false };
  } catch (error) {
    return { status: "FAILED", error: failure(error), permanent: false };
  }
}

// ─── Twilio ──────────────────────────────────────────────────────────────────

async function twilioFetch<T>(creds: TwilioCredentials, url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Basic ${Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64")}`, ...init?.headers },
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  });
  const json = (await response.json().catch(() => ({}))) as T & { message?: string; code?: number };
  if (!response.ok) return { ok: false, status: response.status, error: `${json.message ?? `Twilio responded ${response.status}`}${json.code ? ` (code ${json.code})` : ""}` };
  return { ok: true, data: json };
}

async function twilioTest(creds: TwilioCredentials): Promise<ConnectionTest> {
  const account = await twilioFetch<{ friendly_name?: string; status?: string }>(creds, `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid)}.json`);
  if (!account.ok) return { ok: false, detail: account.status === 401 ? "Account SID or Auth token is wrong." : account.error };
  if (account.data.status && account.data.status !== "active") return { ok: false, detail: `The Twilio account is ${account.data.status}.` };
  return { ok: true, detail: `Connected to Twilio account “${account.data.friendly_name ?? creds.accountSid}”. Messages go from ${creds.from}.` };
}

type TwilioContent = {
  sid: string;
  friendly_name: string;
  language: string;
  types?: Record<string, { body?: string }>;
  approval_requests?: { status?: string; category?: string; name?: string } | null;
};

async function twilioTemplates(creds: TwilioCredentials): Promise<WhatsAppTemplate[]> {
  const result = await twilioFetch<{ contents?: TwilioContent[] }>(creds, "https://content.twilio.com/v1/ContentAndApprovals?PageSize=200");
  if (!result.ok) throw new Error(result.error);
  return (result.data.contents ?? [])
    .filter((c) => (c.approval_requests?.status ?? "").toLowerCase() === "approved")
    .map((c) => {
      const body = Object.values(c.types ?? {}).find((t) => t?.body)?.body ?? "";
      return {
        key: `${c.friendly_name}|${c.sid}`,
        name: c.approval_requests?.name || c.friendly_name,
        ref: c.sid,
        language: c.language,
        category: (c.approval_requests?.category ?? "UTILITY").toUpperCase(),
        body,
        variableCount: countVariables(body),
        unsupported: null,
      };
    });
}

async function twilioSend(creds: TwilioCredentials, to: string, template: { ref: string }, variables: string[], statusCallback: string): Promise<SendResult> {
  try {
    const form = new URLSearchParams({ From: `whatsapp:${creds.from}`, To: `whatsapp:${to}`, ContentSid: template.ref, StatusCallback: statusCallback });
    if (variables.length) form.set("ContentVariables", JSON.stringify(Object.fromEntries(variables.map((v, i) => [String(i + 1), v]))));
    const result = await twilioFetch<{ sid?: string }>(creds, `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid)}/Messages.json`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!result.ok) return { status: "FAILED", error: result.error, permanent: result.status >= 400 && result.status < 500 && result.status !== 429 };
    return result.data.sid ? { status: "SENT", providerMessageId: result.data.sid } : { status: "FAILED", error: "Twilio did not return a message id", permanent: false };
  } catch (error) {
    return { status: "FAILED", error: failure(error), permanent: false };
  }
}

// ─── The four functions the app uses ─────────────────────────────────────────

export async function testConnection(active: ActiveWhatsApp): Promise<ConnectionTest> {
  try {
    return active.provider === "meta" ? await metaTest(active.meta) : await twilioTest(active.twilio);
  } catch (error) {
    return { ok: false, detail: `Could not reach ${active.provider === "meta" ? "Meta" : "Twilio"}: ${failure(error)}` };
  }
}

export async function listTemplates(active: ActiveWhatsApp): Promise<WhatsAppTemplate[]> {
  const templates = active.provider === "meta" ? await metaTemplates(active.meta) : await twilioTemplates(active.twilio);
  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

export async function sendTemplate(
  active: ActiveWhatsApp,
  input: { to: string; template: { name: string; ref: string }; variables: string[]; statusCallback: string },
): Promise<SendResult> {
  return active.provider === "meta"
    ? metaSend(active.meta, input.to, input.template, input.variables)
    : twilioSend(active.twilio, input.to, input.template, input.variables, input.statusCallback);
}
