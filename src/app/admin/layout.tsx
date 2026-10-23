import type { Metadata } from "next";
import { connection } from "next/server";

import "../globals.css";
import { fontVariables } from "../fonts";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: { default: "CRM", template: "%s · Sundaram Palace CRM" },
  robots: { index: false, follow: false, nocache: true },
};

// The CRM is never prerendered: every response carries a fresh CSP nonce
// (src/proxy.ts) and private data.
export const instant = false;

export default async function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  await connection();
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-dvh bg-background">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
