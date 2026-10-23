import "server-only";

import { hasLocale } from "next-intl";
import { locale as rootLocale } from "next/root-params";

import { routing, type Locale } from "./routing";

/** The page's locale from the [locale] root segment, validated. */
export async function currentLocale(): Promise<Locale> {
  const locale = await rootLocale();
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}
