import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { t } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils";
import type { MediaView } from "@/server/cms/queries";

/** Elegant stand-in shown wherever the business hasn't supplied a photograph yet. */
export async function PhotoPlaceholder({ className }: { className?: string }) {
  const tr = await getTranslations("placeholder");
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 bg-blush text-center text-text-muted",
        className,
      )}
    >
      <ImageIcon className="size-6 text-primary/60" aria-hidden="true" />
      <span className="gold-rule" aria-hidden="true" />
      <span className="px-4 text-sm">{tr("photo")}</span>
    </div>
  );
}

/**
 * Cloudinary image with required alt text from the CMS. Aspect ratio comes
 * from `className` (e.g. "aspect-[4/3]") so there is no layout shift.
 */
export async function CmsImage({
  media,
  locale,
  sizes,
  priority = false,
  className,
}: {
  media: MediaView | null;
  locale: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!media || media.resourceType !== "image") {
    return <PhotoPlaceholder className={className} />;
  }
  return (
    <div className={cn("relative overflow-hidden bg-blush", className)}>
      <Image
        src={media.publicId}
        alt={t(media.alt, locale)}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}
