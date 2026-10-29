import { Star } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { t } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils";
import type { TestimonialView } from "@/server/cms/queries";

import { CmsImage } from "./cms-image";

function initials(name: string) {
  return name
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** One guest review: stars, their words, then their photo, name and event. */
export async function TestimonialCard({ testimonial, locale }: { testimonial: TestimonialView; locale: string }) {
  const tr = await getTranslations("home");
  const event = t(testimonial.event, locale);
  return (
    <figure className="flex h-full flex-col rounded-lg border border-gold/30 bg-surface p-6 shadow-card md:p-8">
      <div className="flex gap-1" role="img" aria-label={tr("rated", { rating: testimonial.rating })}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={cn("size-4", n <= testimonial.rating ? "fill-gold text-gold" : "text-border")} aria-hidden="true" />
        ))}
      </div>
      <blockquote className="mt-4 flex-1 font-display text-xl leading-relaxed">“{t(testimonial.quote, locale)}”</blockquote>
      <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-5">
        {testimonial.photo ? (
          <CmsImage media={testimonial.photo} locale={locale} sizes="56px" className="size-14 shrink-0 rounded-full" />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-deep font-display text-lg text-primary-foreground" aria-hidden="true">
            {initials(testimonial.name)}
          </span>
        )}
        <span>
          <span className="block font-semibold">{testimonial.name}</span>
          {event ? <span className="block text-sm text-text-muted">{event}</span> : null}
        </span>
      </figcaption>
    </figure>
  );
}
