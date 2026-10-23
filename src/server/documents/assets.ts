import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import type { DocumentAssets } from "@/lib/pdf/html";

/**
 * Fonts and colour tokens embedded in every document, so rendering never
 * fetches anything from the network (pdf-documents skill). Colours are read
 * from globals.css — the only place they are defined (CLAUDE.md rule 7).
 * The files are included in the server bundle via next.config.ts.
 */

const FONT_DIR = path.join(process.cwd(), "src", "lib", "pdf", "fonts");
const GLOBALS_CSS = path.join(process.cwd(), "src", "app", "globals.css");

const LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT = "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

const FACES: { family: string; file: string; weight: number; range?: string }[] = [
  { family: "PdfInter", file: "inter-latin-400-normal.woff2", weight: 400, range: LATIN },
  { family: "PdfInter", file: "inter-latin-600-normal.woff2", weight: 600, range: LATIN },
  { family: "PdfInter", file: "inter-latin-ext-400-normal.woff2", weight: 400, range: LATIN_EXT },
  { family: "PdfInter", file: "inter-latin-ext-600-normal.woff2", weight: 600, range: LATIN_EXT },
  { family: "PdfCormorant", file: "cormorant-garamond-latin-500-normal.woff2", weight: 500 },
  { family: "PdfCormorant", file: "cormorant-garamond-latin-600-normal.woff2", weight: 600 },
  { family: "PdfTiro", file: "tiro-devanagari-hindi-devanagari-400-normal.woff2", weight: 400 },
  { family: "PdfTiro", file: "tiro-devanagari-hindi-latin-400-normal.woff2", weight: 400, range: LATIN },
];

let cached: DocumentAssets | undefined;

/** Extracts the `--color-*` declarations from the first :root block of globals.css. */
export function tokensFromGlobals(css: string): string {
  const root = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const declarations = root
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^--color-[\w-]+:\s*[^;]+;$/.test(line));
  return `:root { ${declarations.join(" ")} }`;
}

export function documentAssets(): DocumentAssets {
  if (cached) return cached;
  const fontsCss = FACES.map((face) => {
    const data = readFileSync(path.join(FONT_DIR, face.file)).toString("base64");
    return `@font-face { font-family: "${face.family}"; font-style: normal; font-weight: ${face.weight}; src: url(data:font/woff2;base64,${data}) format("woff2");${face.range ? ` unicode-range: ${face.range};` : ""} }`;
  }).join("\n");
  cached = { tokensCss: tokensFromGlobals(readFileSync(GLOBALS_CSS, "utf8")), fontsCss };
  return cached;
}
