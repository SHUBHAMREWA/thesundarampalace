import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";

import en from "../../messages/en.json";
import { routing } from "./routing";

type Messages = { [key: string]: string | Messages };

/** Hindi falls back to English key by key until a fluent speaker fills it in. */
function withFallback(base: Messages, override: Messages): Messages {
  const result: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = base[key];
    result[key] =
      typeof value === "object" && typeof baseValue === "object"
        ? withFallback(baseValue, value)
        : value;
  }
  return result;
}

export default getRequestConfig(async ({ locale: explicit }) => {
  const requested = explicit ?? (await rootLocale());
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const messages =
    locale === "en"
      ? en
      : withFallback(en, (await import(`../../messages/${locale}.json`)).default as Messages);
  return { locale, messages, timeZone: "Asia/Kolkata" };
});
