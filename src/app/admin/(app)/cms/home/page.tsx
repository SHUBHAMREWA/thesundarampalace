import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { PageHeader } from "@/components/crm/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import type { Localized } from "@/lib/i18n/localized";
import { moveHomeSectionAction } from "@/server/actions/cms";
import { cloudinaryConfigured, mediaOptions } from "@/server/services/media";

import { HomeSectionForm } from "./home-section-form";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Homepage" };

const ARROW =
  "flex size-8 items-center justify-center rounded-md border border-border bg-surface text-text-muted hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-30";

const DESCRIPTIONS: Record<string, string> = {
  hero: "Full-screen opening: an image slideshow or a video, with the main buttons. Always first.",
  intro: "Short welcome. Hidden on the website until it has text.",
  venues: "Picture carousel and up to three venue cards from Venues.",
  services: "Picture carousel and links to the celebration pages.",
  catering: "Picture carousel, heading and a link to the Catering page.",
  decor: "Shown once at least one décor theme is published.",
  gallery: "Shown once the gallery has photos.",
  reviews:
    "Guest testimonials (add them under Testimonials) and the Google reviews link from Settings. Shown once either exists.",
  contact:
    "Address, Google map, directions and the enquiry form. Address and map link come from Settings.",
};

export default async function HomeSectionsPage() {
  const [sections, images, videos, page] = await Promise.all([
    db.homeSection.findMany({ orderBy: { sortOrder: "asc" } }),
    mediaOptions("IMAGE"),
    mediaOptions("VIDEO"),
    db.websitePage.findUnique({ where: { kind_slug: { kind: "STANDARD", slug: "home" } }, select: { id: true } }),
  ]);
  const ids = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return (
    <>
      <PageHeader
        title="Homepage"
        actions={
          page ? (
            <Button asChild variant="outline">
              <Link href={`/admin/cms/pages/${page.id}`}>Google title and description</Link>
            </Button>
          ) : null
        }
        description="The sections in the order they appear on the homepage. Use the arrows to move a section up or down; click a section to edit it."
      />
      <ol className="space-y-4">
        {sections.map((section, index) => {
          const content = section.content as Record<string, unknown>;
          const movable = section.type !== "hero";
          return (
            <li key={section.type} className="flex items-start gap-3">
              <div className="flex w-10 shrink-0 flex-col items-center gap-1 pt-3">
                <span
                  className="text-sm font-semibold text-text-muted"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                {movable ? (
                  <>
                    <form
                      action={moveHomeSectionAction.bind(
                        null,
                        section.type,
                        "up",
                      )}
                    >
                      <button
                        type="submit"
                        disabled={index <= 1}
                        aria-label={`Move ${section.type} up`}
                        className={ARROW}
                      >
                        <ArrowUp className="size-4" aria-hidden="true" />
                      </button>
                    </form>
                    <form
                      action={moveHomeSectionAction.bind(
                        null,
                        section.type,
                        "down",
                      )}
                    >
                      <button
                        type="submit"
                        disabled={index === sections.length - 1}
                        aria-label={`Move ${section.type} down`}
                        className={ARROW}
                      >
                        <ArrowDown className="size-4" aria-hidden="true" />
                      </button>
                    </form>
                  </>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <HomeSectionForm
                  key={section.type}
                  type={section.type}
                  description={DESCRIPTIONS[section.type] ?? ""}
                  images={images}
                  videos={videos}
                  uploads={cloudinaryConfigured()}
                  defaults={{
                    heading: (content.heading as Localized | null) ?? null,
                    intro: (content.intro as Localized | null) ?? null,
                    subheading:
                      (content.subheading as Localized | null) ?? null,
                    heroMedia:
                      content.heroMedia === "video" ||
                      (!content.heroMedia &&
                        (content.videoPath || content.videoAssetId))
                        ? "video"
                        : "images",
                    // Older heroes had only a poster: start the slideshow with it.
                    slideAssetIds:
                      ids(content.slideAssetIds).length ||
                      typeof content.posterAssetId !== "string"
                        ? ids(content.slideAssetIds)
                        : [content.posterAssetId],
                    videoAssetId:
                      typeof content.videoAssetId === "string"
                        ? content.videoAssetId
                        : null,
                    videoPath:
                      typeof content.videoPath === "string"
                        ? content.videoPath
                        : "",
                    posterAssetId:
                      typeof content.posterAssetId === "string"
                        ? content.posterAssetId
                        : null,
                    pictureAssetIds: ids(content.pictureAssetIds),
                    visible: section.visible,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
