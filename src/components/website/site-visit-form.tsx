"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { bookSiteVisitAction } from "@/server/actions/site-visit";

const TIME_SLOTS = [
  { value: "morning", label: "Morning (11:00 AM – 01:00 PM)" },
  { value: "afternoon", label: "Afternoon (02:30 PM – 04:30 PM)" },
  { value: "evening", label: "Evening (05:00 PM – 07:00 PM)" },
];

export function SiteVisitForm({
  halls,
  locale,
}: {
  halls: { id: string; slug: string; name: string }[];
  locale: "en" | "hi";
}) {
  const [state, formAction, isPending] = useActionState(bookSiteVisitAction, {});

  const isHindi = locale === "hi";

  if (state.success) {
    return (
      <Card className="max-w-xl mx-auto border-success/40 bg-surface text-center p-8 shadow-md">
        <CardContent className="space-y-6 pt-6">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="size-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-serif font-semibold text-foreground">
              {isHindi ? "स्थल भ्रमण सफलतापूर्वक बुक हो गया!" : "Site Visit Booked Successfully!"}
            </h2>
            <p className="text-sm text-text-muted">
              {isHindi
                ? `आपकी संदर्भ संख्या: ${state.reference}`
                : `Your visit reference: ${state.reference}`}
            </p>
          </div>
          <p className="text-sm text-text-muted">
            {isHindi
              ? "हमारे वेन्यू प्रबंधक आपकी चुनी हुई तारीख और समय पर आपका स्वागत करने के लिए तैयार रहेंगे। हम आपके आगमन से पूर्व पुष्टि संदेश भेजेंगे।"
              : "Our venue concierge will be ready to welcome you and guide you through our grand banquet halls, lawns, and bridal suites."}
          </p>
          <div className="pt-4 flex flex-wrap justify-center gap-4">
            <Button asChild variant="outline">
              <Link href={`/${locale}`}>
                {isHindi ? "होम पेज पर जाएं" : "Return to Home"}
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/${locale}/venues`}>
                {isHindi ? "हॉल्स देखें" : "Explore Venues"}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto border-border bg-surface shadow-sm">
      <CardHeader className="space-y-1 border-b border-border/50 pb-6">
        <CardTitle className="text-2xl font-serif">
          {isHindi ? "स्थल भ्रमण का समय चुनें" : "Schedule an In-Person Tour"}
        </CardTitle>
        <p className="text-sm text-text-muted">
          {isHindi
            ? "द सुंदरम पैलेस के भव्य हॉल्स, मंडप और डाइनिंग क्षेत्रों का व्यक्तिगत अवलोकन करें।"
            : "Experience the architecture, acoustics, and hospitality of The Sundaram Palace firsthand."}
        </p>
      </CardHeader>
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-6">
          {state.error ? (
            <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              {state.error}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="fullName" className="text-sm font-medium">
                {isHindi ? "पूरा नाम *" : "Full Name *"}
              </label>
              <Input
                id="fullName"
                name="fullName"
                placeholder={isHindi ? "उदा. राहुल वर्मा" : "e.g. Rahul Sharma"}
                required
              />
              {state.fieldErrors?.fullName ? (
                <p className="text-xs text-danger">{state.fieldErrors.fullName}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-sm font-medium">
                {isHindi ? "मोबाइल नंबर *" : "Mobile Number *"}
              </label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="9876543210"
                required
              />
              {state.fieldErrors?.phone ? (
                <p className="text-xs text-danger">{state.fieldErrors.phone}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              {isHindi ? "ईमेल पता (वैकल्पिक)" : "Email Address (Optional)"}
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="rahul@example.com"
            />
            {state.fieldErrors?.email ? (
              <p className="text-xs text-danger">{state.fieldErrors.email}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="visitDate" className="text-sm font-medium">
                {isHindi ? "भ्रमण की तारीख *" : "Preferred Date *"}
              </label>
              <Input
                id="visitDate"
                name="visitDate"
                type="date"
                onFocus={(e) => {
                  if (!e.currentTarget.min) {
                    e.currentTarget.min = new Date().toISOString().slice(0, 10);
                  }
                }}
                required
              />
              {state.fieldErrors?.visitDate ? (
                <p className="text-xs text-danger">{state.fieldErrors.visitDate}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="timeSlot" className="text-sm font-medium">
                {isHindi ? "समय स्लॉट *" : "Preferred Time Slot *"}
              </label>
              <select
                id="timeSlot"
                name="timeSlot"
                className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              >
                {TIME_SLOTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="preferredHallSlug" className="text-sm font-medium">
              {isHindi ? "विशेष रुचि वाला हॉल (वैकल्पिक)" : "Hall of Interest (Optional)"}
            </label>
            <select
              id="preferredHallSlug"
              name="preferredHallSlug"
              className="h-10 w-full rounded-md border border-input bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{isHindi ? "सभी हॉल्स देखना चाहते हैं" : "All halls / Complete property"}</option>
              {halls.map((h) => (
                <option key={h.id} value={h.slug}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="notes" className="text-sm font-medium">
              {isHindi ? "अतिरिक्त विवरण या प्रश्न" : "Additional Notes or Questions"}
            </label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder={
                isHindi
                  ? "अनुमानित अतिथि संख्या, संभावित कार्यक्रम की तारीख, या कोई विशेष मांग..."
                  : "Approximate guest count, tentative wedding dates, or specific requirements..."
              }
            />
          </div>

          <div className="space-y-1">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-text-muted">
              <input
                type="checkbox"
                name="consent"
                value="true"
                required
                className="mt-0.5 size-4 rounded border-input text-primary focus:ring-primary"
              />
              <span>
                {isHindi
                  ? "मैं सहमत हूं कि द सुंदरम पैलेस की टीम स्थल भ्रमण के समन्वय हेतु मुझसे संपर्क कर सकती है।"
                  : "I agree that The Sundaram Palace team may contact me via WhatsApp or phone to confirm this site visit."}
              </span>
            </label>
            {state.fieldErrors?.consent ? (
              <p className="text-xs text-danger">{state.fieldErrors.consent}</p>
            ) : null}
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={isPending}>
            {isPending
              ? isHindi
                ? "बुक किया जा रहा है…"
                : "Scheduling Tour…"
              : isHindi
                ? "स्थल भ्रमण बुक करें"
                : "Confirm Site Visit"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
