import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { t } from "@/lib/i18n/localized";
import type { HallView } from "@/server/cms/queries";

import { CmsImage } from "./cms-image";

/** Homepage venue card: first photo, title and description, linking to the venue on the Venues page. */
export async function HallCard({ hall, locale }: { hall: HallView; locale: string }) {
  const cta = await getTranslations("cta");
  const description = t(hall.description, locale);
  return (
    <article className="group flex flex-col overflow-hidden rounded-lg bg-surface shadow-card">
      <CmsImage
        media={hall.images[0] ?? null}
        locale={locale}
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        className="aspect-[4/3]"
      />
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-display-3">{t(hall.name, locale)}</h3>
        {description ? <p className="mt-2 line-clamp-3 text-text-muted">{description.replace(/[#*_[\]()-]/g, "").trim()}</p> : null}
        <Link
          href={`/venues#${hall.slug}`}
          className="mt-auto inline-flex pt-6 text-sm font-medium text-primary underline-offset-4 group-hover:underline"
        >
          {cta("viewVenue")} <span aria-hidden="true">&nbsp;→</span>
        </Link>
      </div>
    </article>
  );
}
