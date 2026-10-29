"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const LOCALES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
] as const;

/** English / हिंदी choice shown inside the mobile menu (the header switch is hidden on phones). */
export function MenuLanguageSwitch({ onSelect }: { onSelect?: () => void }) {
  const t = useTranslations("site");
  const locale = useLocale();
  const pathname = usePathname();
  return (
    <div className="mt-6 border-t border-border pt-5">
      <p className="mb-2 flex items-center gap-2 px-3 text-xs font-medium tracking-[0.15em] text-text-muted uppercase">
        <Languages className="size-4" aria-hidden="true" />
        {t("language")}
      </p>
      <div className="grid grid-cols-2 gap-1 rounded-full bg-blush/60 p-1">
        {LOCALES.map((l) =>
          l.code === locale ? (
            <span key={l.code} aria-current="true" lang={l.code} className="rounded-full bg-primary py-2 text-center text-sm font-medium text-primary-foreground">
              {l.label}
            </span>
          ) : (
            <Link
              key={l.code}
              href={pathname}
              locale={l.code}
              lang={l.code}
              hrefLang={l.code}
              onClick={onSelect}
              className={cn("rounded-full py-2 text-center text-sm font-medium text-primary transition-colors hover:bg-surface")}
            >
              {l.label}
            </Link>
          ),
        )}
      </div>
    </div>
  );
}
