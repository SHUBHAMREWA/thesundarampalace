import { getTranslations } from "next-intl/server";

import { Container } from "@/components/layout/container";

export async function SiteFooter() {
  const t = await getTranslations();
  return (
    <footer className="bg-primary-deep py-10 text-sm text-blush">
      <Container className="flex flex-col items-center gap-3 text-center">
        <span className="gold-rule" aria-hidden="true" />
        <p className="font-display text-xl text-primary-foreground">{t("site.name")}</p>
        <p>
          © {t("site.name")}. {t("footer.rights")}
        </p>
      </Container>
    </footer>
  );
}
