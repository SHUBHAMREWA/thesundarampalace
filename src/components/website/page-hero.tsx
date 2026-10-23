import { Container } from "@/components/layout/container";
import type { MediaView } from "@/server/cms/queries";

import { CmsImage } from "./cms-image";

/** Title band for inner pages; uses the CMS hero image when there is one. */
export async function PageHero({
  title,
  summary,
  eyebrow,
  hero,
  locale,
}: {
  title: string;
  summary?: string;
  eyebrow?: string;
  hero?: MediaView | null;
  locale: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-primary-deep text-primary-foreground">
      {hero ? (
        <>
          <CmsImage media={hero} locale={locale} sizes="100vw" priority className="absolute inset-0 -z-20" />
          <div className="absolute inset-0 -z-10 bg-primary-deep/70" aria-hidden="true" />
        </>
      ) : null}
      <Container className="flex flex-col items-center py-20 text-center md:py-28">
        {eyebrow ? <p className="text-xs font-medium tracking-[0.2em] text-blush uppercase">{eyebrow}</p> : null}
        <span className="gold-rule mt-3" aria-hidden="true" />
        <h1 className="text-display-1 mt-5">{title}</h1>
        {summary ? <p className="text-body-lg mt-5 max-w-2xl text-blush">{summary}</p> : null}
      </Container>
    </section>
  );
}
