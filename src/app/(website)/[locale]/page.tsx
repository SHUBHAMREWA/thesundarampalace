import { getTranslations } from "next-intl/server";

import { Container } from "@/components/layout/container";

/**
 * Phase 1 placeholder. The real homepage (hero film, venue spaces, enquiry
 * flow) is built in Phase 2 from CMS content — no business facts here.
 */
export default async function HomePage() {
  const t = await getTranslations("home");
  return (
    <section className="bg-primary-deep py-24 text-primary-foreground md:py-32">
      <Container className="flex flex-col items-center text-center">
        <p className="text-sm tracking-[0.2em] uppercase">{t("eyebrow")}</p>
        <span className="gold-rule mt-4" aria-hidden="true" />
        <h1 className="text-display-1 mt-6">{t("title")}</h1>
        <p className="text-body-lg mt-6 max-w-xl text-blush">{t("comingSoon")}</p>
      </Container>
    </section>
  );
}
