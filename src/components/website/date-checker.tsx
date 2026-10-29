"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PublicDateCheckResult } from "@/server/services/availability";

export function DateChecker({
  initialData,
  locale,
}: {
  initialData: PublicDateCheckResult;
  locale: "en" | "hi";
}) {
  const [date, setDate] = useState(initialData.date);
  const [data, setData] = useState<PublicDateCheckResult>(initialData);
  const [loading, setLoading] = useState(false);

  async function handleDateChange(newDate: string) {
    setDate(newDate);
    if (!newDate) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/availability/check?date=${newDate}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Keep existing data on error
    } finally {
      setLoading(false);
    }
  }

  const isHindi = locale === "hi";

  return (
    <div className="space-y-8">
      {/* Date selector toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="space-y-1">
          <label htmlFor="avail-date" className="text-sm font-semibold tracking-wide uppercase text-text-muted">
            {isHindi ? "कार्यक्रम की तारीख चुनें" : "Select celebration date"}
          </label>
          <div className="flex items-center gap-3">
            <Input
              id="avail-date"
              type="date"
              value={date}
              onFocus={(e) => {
                if (!e.currentTarget.min) {
                  e.currentTarget.min = new Date().toISOString().slice(0, 10);
                }
              }}
              onChange={(e) => handleDateChange(e.target.value)}
              className="max-w-[220px] bg-surface text-base font-medium"
            />
            {loading ? (
              <span className="text-xs text-text-muted animate-pulse">
                {isHindi ? "जांच की जा रही है…" : "Checking…"}
              </span>
            ) : null}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-success" />
            <span>{isHindi ? "पूरा दिन उपलब्ध" : "Free all day"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-warning" />
            <span>{isHindi ? "कुछ समय आरक्षित" : "Some times taken"}</span>
          </div>
        </div>
      </div>

      {data.halls.length ? null : (
        <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-text-muted">
          {isHindi ? "हॉल की जानकारी जल्द आ रही है। अपनी तारीख के लिए हमसे पूछताछ करें।" : "Hall details are coming soon. Send us an enquiry for your date."}
        </p>
      )}

      {/* Results grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {data.halls.map((hall) => {
          const free = hall.status === "AVAILABLE";
          const Icon = free ? CheckCircle2 : Clock;
          return (
            <Card key={hall.hallId} className="flex flex-col justify-between">
              <CardHeader className="flex flex-row items-start justify-between gap-2 border-b border-border/50 pb-4">
                <CardTitle className="font-serif text-xl">{hall.hallName}</CardTitle>
                <Badge variant={free ? "success" : "warning"} className="flex items-center gap-1 font-normal">
                  <Icon className="size-3" aria-hidden="true" />
                  {free ? (isHindi ? "उपलब्ध" : "Available") : isHindi ? "सीमित" : "Limited"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <p className="text-sm text-text-muted">
                  {free
                    ? isHindi
                      ? "इस तारीख पर हॉल में अभी कोई कार्यक्रम नहीं है।"
                      : "Nothing is booked in this hall on this date yet."
                    : isHindi
                      ? "इस दिन कुछ समय पहले से आरक्षित है। अपना समय बताएं, हम उपलब्धता की पुष्टि करेंगे।"
                      : "Some times on this date are already taken. Tell us your timing and we will confirm."}
                </p>
                <Button asChild className="w-full" size="sm" variant={free ? "default" : "outline"}>
                  <Link href={`/${locale}/plan-your-event?date=${date}&hall=${hall.hallSlug}`}>
                    {isHindi ? "इस तारीख के लिए पूछताछ करें" : "Enquire for this date"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-blush/30 p-6 text-center text-sm text-text-muted space-y-2">
        <p className="font-medium text-foreground">
          {isHindi
            ? "शुभ लग्न व विशेष मुहूर्तों की तिथियां शीघ्र भर जाती हैं।"
            : "Auspicious dates and peak wedding weekends reserve quickly."}
        </p>
        <p>
          {isHindi
            ? "अपनी मनपसंद तारीख और हॉल सुनिश्चित करने के लिए पहले से पूछताछ करें।"
            : "We recommend reserving your preferred space and timing well in advance."}
        </p>
      </div>
    </div>
  );
}
