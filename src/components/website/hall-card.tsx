import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { t } from "@/lib/i18n/localized";
import type { HallView } from "@/server/cms/queries";

import { CmsImage } from "./cms-image";

/** Largest verified capacity across layouts, or null when not supplied yet. */
export function maxCapacity(hall: HallView): number | null {
  const values = hall.capacities.map((c) => c.maxGuests).filter((v): v is number => v !== null);
  return values.length ? Math.max(...values) : null;
}

export async function HallCard({ hall, locale }: { hall: HallView; locale: string }) {
  const [tr, cta, ph] = await Promise.all([
    getTranslations("venues"),
    getTranslations("cta"),
    getTranslations("placeholder"),
  ]);
  const capacity = maxCapacity(hall);
  return (
    <article className="group flex flex-col overflow-hidden rounded-lg bg-surface shadow-card">
      <CmsImage
        media={hall.hero ?? hall.images[0] ?? null}
        locale={locale}
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        className="aspect-[4/3]"
      />
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-display-3">{t(hall.name, locale)}</h3>
        {hall.summary ? <p className="mt-2 text-text-muted">{t(hall.summary, locale)}</p> : null}
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-text-muted">{tr("capacity")}</dt>
            <dd className="font-medium">{capacity ? tr("capacityUpTo", { max: capacity }) : ph("facts")}</dd>
          </div>
          <div>
            <dt className="text-text-muted">{tr("area")}</dt>
            <dd className="font-medium">{hall.areaSqFt ? tr("sqft", { value: hall.areaSqFt.toLocaleString("en-IN") }) : ph("facts")}</dd>
          </div>
        </dl>
        <Link
          href={`/venues/${hall.slug}`}
          className="mt-6 inline-flex text-sm font-medium text-primary underline-offset-4 group-hover:underline"
        >
          {cta("viewVenue")} <span aria-hidden="true">&nbsp;→</span>
        </Link>
      </div>
    </article>
  );
}
