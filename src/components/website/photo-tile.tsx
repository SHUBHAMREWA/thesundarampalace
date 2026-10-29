import { t } from "@/lib/i18n/localized";
import { cloudinaryImageUrl } from "@/lib/media/cloudinary";
import { cn } from "@/lib/utils";
import type { MediaView } from "@/server/cms/queries";

import { CmsImage } from "./cms-image";

/**
 * A photo that opens in the large view (inside a LightboxGroup). Its title —
 * the photo's caption from the CMS — shows over the photo on hover and under
 * it in the large view.
 */
export function PhotoTile({
  media,
  locale,
  sizes,
  priority = false,
  label,
  className,
}: {
  media: MediaView;
  locale: string;
  sizes: string;
  priority?: boolean;
  /** Small line above the title on hover, e.g. the gallery category. */
  label?: string;
  className?: string;
}) {
  const title = t(media.caption, locale);
  return (
    <a
      href={cloudinaryImageUrl(media.publicId, 2000)}
      data-lightbox=""
      data-title={title}
      data-alt={t(media.alt, locale)}
      aria-label={title || t(media.alt, locale)}
      className={cn(
        "group relative block overflow-hidden rounded-lg focus-visible:outline-offset-4",
        className,
      )}
    >
      <CmsImage
        media={media}
        locale={locale}
        sizes={sizes}
        priority={priority}
        className="size-full transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
      />
      {title || label ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary-deep/85 to-transparent px-4 pt-10 pb-3 text-left text-primary-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          {label ? (
            <span className="block text-xs font-medium tracking-wider text-gold uppercase">
              {label}
            </span>
          ) : null}
          {title ? (
            <span className="block font-display text-lg">{title}</span>
          ) : null}
        </span>
      ) : null}
    </a>
  );
}
