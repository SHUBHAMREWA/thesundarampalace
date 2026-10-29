import type { Metadata } from "next";
import { currentLocale } from "@/i18n/current";

import { Container } from "@/components/layout/container";
import { PageHero } from "@/components/website/page-hero";
import { BrochureDownloadForm } from "@/components/website/brochure-download-form";
import { Building, Utensils, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Download Luxury E-Brochure",
  description: "Official venue brochure with hall dimensions, seating capacities, catering menus, and policies.",
};

export default async function BrochurePage() {
  const locale = await currentLocale();
  const isHindi = locale === "hi";

  const highlights = [
    {
      icon: Building,
      title: isHindi ? "हॉल्स और सिटिंग व्यवस्था" : "Venues & Capacities",
      desc: isHindi
        ? "थिएटर, क्लस्टर और फ्लोटिंग बैठक व्यवस्था के सटीक क्षेत्रफल व नक्शे।"
        : "Detailed square footage, ceiling heights, and layout plans for 100 to 2,000+ guests.",
    },
    {
      icon: Utensils,
      title: isHindi ? "खानपान एवं शाही मेनू" : "Curated Royal Dining",
      desc: isHindi
        ? "शुद्ध शाकाहारी व जैन व्यंजन, स्वागत पेय और लाइव काउंटर सूचियां।"
        : "Sample royal menus, Jain options, live counters, and high-tea menus.",
    },
    {
      icon: Shield,
      title: isHindi ? "पारदर्शी नियम व नीतियां" : "Transparent Policies",
      desc: isHindi
        ? "बुकिंग अग्रिम, भुगतान अनुसूची, साउंड कट-ऑफ समय और सुरक्षा नियम।"
        : "Clear booking terms, instalment schedule, sound cut-off guidelines, and security deposits.",
    },
  ];

  return (
    <>
      <PageHero
        title={isHindi ? "आधिकारिक ई-विवरणिका" : "Official E-Brochure"}
        summary={
          isHindi
            ? "द सुंदरम पैलेस के भव्य हॉल्स, शाही खानपान और आतिथ्य सेवाओं का सम्पूर्ण मार्गदर्शक।"
            : "Everything you need to plan your celebration: floor plans, menus, decor themes, and booking terms."
        }
        locale={locale}
      />
      <section className="py-16 md:py-24">
        <Container>
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div className="space-y-8">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  {isHindi ? "सम्पूर्ण जानकारी एक दस्तावेज़ में" : "All Venue Details in One Guide"}
                </p>
                <h2 className="text-3xl font-serif font-bold text-foreground">
                  {isHindi ? "भव्य उत्सवों की सटीक योजना" : "Everything You Need for a Seamless Celebration"}
                </h2>
                <p className="text-text-muted leading-relaxed">
                  {isHindi
                    ? "चाहे शाही शादी हो, सगाई समारोह या कॉर्पोरेट उत्सव — हमारी विस्तृत ई-विवरणिका आपके परिवार और योजनाकारों को सर्वोत्तम निर्णय लेने में सहायता करेगी।"
                    : "Whether you are planning a five-day luxury wedding or an intimate engagement banquet, our brochure provides every fact and specification to help your family decide with confidence."}
                </p>
              </div>

              <div className="space-y-4">
                {highlights.map((h, i) => {
                  const Icon = h.icon;
                  return (
                    <div key={i} className="flex gap-4 items-start">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground text-base">{h.title}</h3>
                        <p className="text-sm text-text-muted">{h.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <BrochureDownloadForm locale={locale} />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
