import { Cormorant_Garamond, Inter, Tiro_Devanagari_Hindi } from "next/font/google";

export const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const tiroDevanagari = Tiro_Devanagari_Hindi({
  subsets: ["devanagari", "latin"],
  weight: "400",
  variable: "--font-tiro-devanagari",
  display: "swap",
});

export const fontVariables = `${cormorant.variable} ${inter.variable} ${tiroDevanagari.variable}`;
