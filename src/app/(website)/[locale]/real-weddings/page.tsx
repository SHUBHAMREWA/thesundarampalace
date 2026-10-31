import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import Link from "next/link";
import { Camera, Heart, Sparkles } from "lucide-react";
import { currentLocale } from "@/i18n/current";

import { Container } from "@/components/layout/container";
import { PageHero } from "@/components/website/page-hero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/i18n/localized";
import { formatDateKey, dateKey } from "@/lib/time";
import { listPublicRealWeddings } from "@/server/services/real-weddings";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    locale: await currentLocale(),
    path: "/real-weddings",
    title: "Real Wedding Stories",
    description: "Browse curated wedding stories and celebrations hosted at The Sundaram Palace.",
  });
}

export default async function RealWeddingsPage() {
  const locale = await currentLocale();
  const weddings = await listPublicRealWeddings();

  const isHindi = locale === "hi";

  return (
    <>
      <PageHero
        title={isHindi ? "विवाह गाथाएं" : "Real Wedding Stories"}
        summary={
          isHindi
            ? "द सुंदरम पैलेस में संपन्न हुए कुछ अविस्मरणीय और भव्य विवाह समारोहों की झलकियां।"
            : "Moments of love, heritage, and joy celebrated within our grand halls and manicured lawns."
        }
        locale={locale}
      />
      <section className="py-16 md:py-24">
        <Container>
          {weddings.length ? (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {weddings.map((w) => (
                <Card key={w.id} className="group overflow-hidden border-border bg-surface transition-all hover:border-primary/50">
                  <CardHeader className="space-y-2">
                    <p className="text-xs font-semibold tracking-wider uppercase text-primary flex items-center gap-1.5">
                      <Heart className="size-3 fill-primary/20" />
                      {w.eventDate ? formatDateKey(dateKey(w.eventDate), "MMMM yyyy") : "Celebration"}
                    </p>
                    <CardTitle className="text-2xl font-serif">
                      <Link href={`/${locale}/real-weddings/${w.slug}`} className="hover:text-primary transition-colors">
                        {t(w.coupleName, locale)}
                      </Link>
                    </CardTitle>
                    {w.hallUsed ? (
                      <p className="text-xs text-text-muted">
                        Venue: {t(w.hallUsed, locale)}
                      </p>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {w.summary ? (
                      <p className="text-sm text-text-muted line-clamp-3">
                        {t(w.summary, locale)}
                      </p>
                    ) : null}
                    <div className="flex items-center justify-between border-t border-border/50 pt-3 text-xs text-text-muted">
                      {w.photographerCredit ? (
                        <span className="flex items-center gap-1">
                          <Camera className="size-3 text-primary" />
                          {w.photographerCredit}
                        </span>
                      ) : <span />}
                      <Link href={`/${locale}/real-weddings/${w.slug}`} className="font-semibold text-primary hover:underline">
                        {isHindi ? "विवाह गाथा देखें &rarr;" : "View story &rarr;"}
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface/50 p-12 text-center">
              <Sparkles className="mx-auto size-10 text-primary/40 mb-3" />
              <h3 className="text-lg font-serif font-medium text-foreground">
                {isHindi ? "विवाह गाथाएं शीघ्र प्रकाशित होंगी" : "Real wedding features coming soon"}
              </h3>
              <p className="text-sm text-text-muted mt-1 max-w-md mx-auto">
                {isHindi
                  ? "हम अपने परिवारों की सहमति से चुनिंदा विवाह समारोहों की भव्य तस्वीरें और कहानियां शीघ्र प्रस्तुत करेंगे।"
                  : "We only publish consented wedding stories honoring family privacy and photographer credits."}
              </p>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
