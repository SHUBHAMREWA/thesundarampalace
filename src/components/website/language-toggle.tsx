"use client";

import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";

export function LanguageToggle() {
  const t = useTranslations("site");
  const locale = useLocale();
  const pathname = usePathname();
  const other = locale === "en" ? "hi" : "en";
  return (
    <Link
      href={pathname}
      locale={other}
      lang={other}
      hrefLang={other}
      aria-label={t("language")}
      className="rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-blush"
    >
      {t("switchTo")}
    </Link>
  );
}
