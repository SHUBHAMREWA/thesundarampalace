import type { Metadata } from "next";

import { PageHeader } from "@/components/crm/page-header";
import { db } from "@/lib/db";
import type { Localized } from "@/lib/i18n/localized";
import { mediaOptions } from "@/server/services/media";

import { HomeSectionForm } from "./home-section-form";

export const metadata: Metadata = { title: "Homepage" };

const DESCRIPTIONS: Record<string, string> = {
  hero: "Full-screen opening with the venue film (or poster image) and the main buttons.",
  intro: "Short welcome. Hidden on the website until it has text.",
  venues: "Up to three venue cards from Venues.",
  services: "Links to the celebration pages.",
  catering: "Heading and introduction with a link to the Catering page.",
  decor: "Shown once at least one décor theme is published.",
  packages: "Shown once at least one package is published.",
  gallery: "Shown once the gallery has photos.",
  reviews: "Links to Google reviews. Shown once the Google reviews link is set in Settings.",
  dates: "Shown once popular dates are added under Dates.",
  contact: "Address and contact buttons from Settings.",
};

export default async function HomeSectionsPage() {
  const [sections, media] = await Promise.all([
    db.homeSection.findMany({ orderBy: { sortOrder: "asc" } }),
    mediaOptions("IMAGE"),
  ]);
  return (
    <>
      <PageHeader title="Homepage" description="Order, visibility and text of each homepage section (lower sort order appears first)." />
      <div className="space-y-4">
        {sections.map((section) => {
          const content = section.content as Record<string, unknown>;
          return (
            <HomeSectionForm
              key={section.type}
              type={section.type}
              description={DESCRIPTIONS[section.type] ?? ""}
              media={media}
              defaults={{
                heading: (content.heading as Localized | null) ?? null,
                intro: (content.intro as Localized | null) ?? null,
                subheading: (content.subheading as Localized | null) ?? null,
                videoPath: typeof content.videoPath === "string" ? content.videoPath : "",
                posterAssetId: typeof content.posterAssetId === "string" ? content.posterAssetId : null,
                visible: section.visible,
                sortOrder: section.sortOrder,
              }}
            />
          );
        })}
      </div>
    </>
  );
}
