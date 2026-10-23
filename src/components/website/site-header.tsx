import { getTranslations } from "next-intl/server";

import { Container } from "@/components/layout/container";
import { Link } from "@/i18n/navigation";

import { LanguageToggle } from "./language-toggle";

export async function SiteHeader() {
  const t = await getTranslations("site");
  return (
    <header className="border-b border-border bg-surface">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="font-display text-2xl font-semibold text-primary">
          {t("name")}
        </Link>
        <LanguageToggle />
      </Container>
    </header>
  );
}
