import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { currentLocale } from "@/i18n/current";

import { Container } from "@/components/layout/container";
import { PageHero } from "@/components/website/page-hero";
import { DateChecker } from "@/components/website/date-checker";
import { todayIST } from "@/lib/time";
import { checkPublicDateAvailability } from "@/server/services/availability";

export const metadata: Metadata = {
  title: "Check Date Availability",
  description: "Check whether a hall is free on your date at The Sundaram Palace.",
};

async function DynamicDateChecker({ locale }: { locale: "en" | "hi" }) {
  await connection();
  const initialDate = todayIST();
  const availability = await checkPublicDateAvailability(initialDate);
  return <DateChecker initialData={availability} locale={locale} />;
}

export default async function CheckDatePage() {
  const locale = await currentLocale();
  const isHindi = locale === "hi";

  return (
    <>
      <PageHero
        title={isHindi ? "तारीख की उपलब्धता" : "Check Date Availability"}
        summary={
          isHindi
            ? "द सुंदरम पैलेस के भव्य हॉल्स और उत्सव स्थलों की वास्तविक समय उपलब्धता जांचें।"
            : "Check whether our halls are free on your wedding or event date."
        }
        locale={locale}
      />
      <section className="py-16 md:py-24">
        <Container className="max-w-4xl">
          <Suspense fallback={<div className="h-48 rounded-xl border border-border bg-blush/20 animate-pulse" />}>
            <DynamicDateChecker locale={locale} />
          </Suspense>
        </Container>
      </section>
    </>
  );
}
