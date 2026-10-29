"use client";

import { useState } from "react";
import { Download, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function BrochureDownloadForm({ locale }: { locale: "en" | "hi" }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHindi = locale === "hi";

  async function handleDownload(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setError(isHindi ? "डाउनलोड करने के लिए कृपया सहमति दें" : "Please accept the consent to continue");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/brochure/download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          email: email || undefined,
          consent: true,
          locale,
        }),
      });

      if (!res.ok) {
        throw new Error(isHindi ? "डाउनलोड विफल रहा। कृपया बाद में प्रयास करें।" : "Download failed. Please try again.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "The-Sundaram-Palace-Brochure.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error downloading brochure");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-md mx-auto border-border bg-surface shadow-sm">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
          <FileText className="size-6" />
        </div>
        <CardTitle className="text-xl font-serif">
          {isHindi ? "आधिकारिक ई-विवरणिका प्राप्त करें" : "Download Official E-Brochure"}
        </CardTitle>
        <p className="text-xs text-text-muted">
          {isHindi
            ? "हॉल विनिर्देश, सिटिंग क्षमताएं और कैटरिंग विकल्पों का पूर्ण विवरण।"
            : "Complete venue facts, floor capacities, catering menus, and policy guidelines."}
        </p>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleDownload} className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
              {error}
            </div>
          ) : null}

          <div className="space-y-1">
            <label htmlFor="b-name" className="text-xs font-medium">
              {isHindi ? "पूरा नाम *" : "Your Name *"}
            </label>
            <Input
              id="b-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={isHindi ? "उदा. विकास मेहता" : "e.g. Vikas Mehta"}
              required
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="b-phone" className="text-xs font-medium">
              {isHindi ? "मोबाइल नंबर *" : "Mobile Number *"}
            </label>
            <Input
              id="b-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9876543210"
              required
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="b-email" className="text-xs font-medium">
              {isHindi ? "ईमेल (वैकल्पिक)" : "Email Address (Optional)"}
            </label>
            <Input
              id="b-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vikas@example.com"
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer text-xs text-text-muted pt-1">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
              className="mt-0.5 size-3.5 rounded border-input text-primary focus:ring-primary"
            />
            <span>
              {isHindi
                ? "मैं विवरणिका प्राप्त करने और कार्यक्रम योजना संबंधी जानकारी के लिए संपर्क की सहमति देता/देती हूं।"
                : "I agree to receive the venue brochure and event planning assistance."}
            </span>
          </label>

          <Button type="submit" className="w-full" disabled={loading}>
            <Download className="size-4 mr-2" />
            {loading
              ? isHindi
                ? "डाउनलोड हो रहा है…"
                : "Preparing PDF…"
              : isHindi
                ? "विवरणिका डाउनलोड करें (PDF)"
                : "Download Brochure (PDF)"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
