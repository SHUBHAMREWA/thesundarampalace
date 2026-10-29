import { MessageSquareQuote } from "lucide-react";
import type { Metadata } from "next";

import { SimpleCmsList } from "@/components/cms/simple-list";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Testimonials" };

export default async function TestimonialsPage() {
  const [rows, placements] = await Promise.all([
    db.testimonial.findMany({ orderBy: { createdAt: "desc" } }),
    db.mediaPlacement.findMany({ where: { ownerType: "testimonial" }, include: { asset: { select: { publicId: true } } } }),
  ]);
  const photo = new Map(placements.map((p) => [p.ownerId, p.asset.publicId]));
  return (
    <SimpleCmsList
      title="Testimonials"
      description="Reviews from real guests: their name, photo, what they said and their star rating. Shown on the homepage between Gallery and Contact, newest first. Only add reviews the guest has agreed to share."
      newHref="/admin/cms/testimonials/new"
      newLabel="Add testimonial"
      icon={MessageSquareQuote}
      emptyText="No testimonials yet"
      showThumbs
      items={rows.map((row) => {
        const quote = t(row.quote, "en");
        return {
          id: row.id,
          href: `/admin/cms/testimonials/${row.id}`,
          title: row.name,
          subtitle: `${"★".repeat(row.rating)}${"☆".repeat(5 - row.rating)} · ${quote.length > 90 ? `${quote.slice(0, 90)}…` : quote}`,
          live: row.published && row.consent,
          warning: row.consent ? undefined : "Guest's permission not ticked",
          thumb: photo.get(row.id) ?? null,
        };
      })}
    />
  );
}
