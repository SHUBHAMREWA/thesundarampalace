import localFont from "next/font/local";

// Self-hosted from src/lib/pdf/fonts (the same files the PDFs embed), so dev
// and builds never fetch from Google Fonts.
export const cormorant = localFont({
  src: [
    {
      path: "../lib/pdf/fonts/cormorant-garamond-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../lib/pdf/fonts/cormorant-garamond-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-cormorant",
  display: "swap",
});

export const inter = localFont({
  // Variable font, weights 300–600. 300 is the light weight for website introductions (.text-body-lg).
  src: [
    {
      path: "../lib/pdf/fonts/inter-latin-variable.woff2",
      weight: "300 600",
      style: "normal",
    },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const tiroDevanagari = localFont({
  // Devanagari glyphs only; Latin characters fall through to the next font in the stack.
  src: [
    {
      path: "../lib/pdf/fonts/tiro-devanagari-hindi-devanagari-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-tiro-devanagari",
  display: "swap",
});

export const fontVariables = `${cormorant.variable} ${inter.variable} ${tiroDevanagari.variable}`;
