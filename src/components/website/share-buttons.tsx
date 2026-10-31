"use client";

import { Check, Link2, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { Button } from "@/components/ui/button";

const noSubscribe = () => () => {};

/**
 * Share an article: WhatsApp, Facebook, copy the link, and the phone's own
 * share sheet where the browser has one. Plain links; no third-party scripts.
 */
export function ShareButtons({
  url,
  title,
  locale,
}: {
  url: string;
  title: string;
  locale: string;
}) {
  const hi = locale === "hi";
  const [copied, setCopied] = useState(false);
  // Known only in the browser; the server renders without it so hydration matches.
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
  const text = `${title} — ${url}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: nothing to do, the address bar still has the link.
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-text-muted">
        {hi ? "शेयर करें:" : "Share:"}
      </span>
      <Button asChild variant="outline" size="sm">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <WhatsAppIcon className="size-4" /> WhatsApp
        </a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Facebook
        </a>
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
        {copied ? (hi ? "कॉपी हो गया" : "Copied") : hi ? "लिंक कॉपी करें" : "Copy link"}
      </Button>
      {canShare ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigator.share({ title, url }).catch(() => {})}
        >
          <Share2 aria-hidden="true" /> {hi ? "और" : "More"}
        </Button>
      ) : null}
    </div>
  );
}
