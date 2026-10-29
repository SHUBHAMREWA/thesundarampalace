import { Container } from "@/components/layout/container";
import type { MediaView } from "@/server/cms/queries";

import { CmsImage } from "./cms-image";

/**
 * Title band for inner pages; uses the CMS hero image when there is one.
 * Same height on every page (content centred), whether or not it has an
 * eyebrow or summary line; only a very long summary on a phone grows it.
 */
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
    <section className="relative isolate flex min-h-64 items-center overflow-hidden bg-primary-deep text-primary-foreground md:min-h-72">
      {hero ? (
        <>
          <CmsImage media={hero} locale={locale} sizes="100vw" priority className="absolute inset-0 -z-20" />
          <div className="absolute inset-0 -z-10 bg-primary-deep/70" aria-hidden="true" />
        </>
      ) : null}
      <Container className="flex w-full flex-col items-center py-8 text-center md:py-10">
        {eyebrow ? <p className="text-xs font-medium tracking-[0.2em] text-blush uppercase">{eyebrow}</p> : null}
        <span className="gold-rule mt-3" aria-hidden="true" />
        <h1 className="text-display-1 mt-5">{title}</h1>
        {summary ? <p className="text-body-lg mt-5 max-w-2xl text-blush">{summary}</p> : null}
      </Container>
    </section>
  );
}
