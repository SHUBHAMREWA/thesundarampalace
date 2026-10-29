import { getTranslations } from "next-intl/server";

import { RichText } from "@/lib/content/rich-text";
import type { MediaView } from "@/server/cms/queries";

import { LightboxGroup } from "./lightbox";
import { PhotoTile } from "./photo-tile";

/**
 * One item on the Venues, Décor and Celebrations pages: a title, its
 * description, then all its photos in a gallery grid (click to enlarge).
 * Items stack one below the other; `id` makes each one linkable
 * (e.g. /venues#grand-lawn).
 */
export async function ShowcaseBlock({
  id,
  title,
  description,
  images,
  locale,
  index,
}: {
  id: string;
  title: string;
  description: string;
  images: MediaView[];
  locale: string;
  /** Position on the page; the first photos load first. */
  index: number;
}) {
  const tr = await getTranslations("lightbox");
  return (
    <article id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <div className="mx-auto max-w-3xl text-center">
        <span className="gold-rule mx-auto" aria-hidden="true" />
        <h2 id={`${id}-title`} className="text-display-2 mt-4">{title}</h2>
        {description ? (
          <div className="text-body-lg mt-5 text-text-muted">
            <RichText source={description} className="space-y-3" />
          </div>
        ) : null}
      </div>
      {images.length ? (
        <LightboxGroup labels={{ close: tr("close"), previous: tr("previous"), next: tr("next") }}>
          <ul className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            {images.map((image, i) => (
              <li key={image.publicId} className={i === 0 && images.length > 2 ? "col-span-2 md:row-span-2" : undefined}>
                <PhotoTile
                  media={image}
                  locale={locale}
                  sizes={i === 0 ? "(min-width: 768px) 66vw, 100vw" : "(min-width: 768px) 33vw, 50vw"}
                  priority={index === 0 && i === 0}
                  className="aspect-[4/3] h-full"
                />
              </li>
            ))}
          </ul>
        </LightboxGroup>
      ) : null}
    </article>
  );
}
