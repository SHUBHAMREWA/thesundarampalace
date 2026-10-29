import "server-only";

import { createHash, createHmac } from "node:crypto";

/**
 * HTML → PDF (architecture.md ADR-08). Two drivers, chosen by PDF_RENDERER:
 *
 * - "local":   Playwright Chromium in this process. Used in development and
 *              tests (Playwright is a dev dependency, never bundled).
 * - "service": the small `pdf-service/` container (free Render web service),
 *              called with an HMAC-signed request. It has no database access
 *              and blocks every network request while rendering.
 * - "none":    no server PDFs; staff use the preview's Print / Save as PDF.
 *
 * In every case the HTML is the same trusted template the preview shows.
 */

export type RendererMode = "local" | "service" | "none";

export function rendererMode(): RendererMode {
  const configured = process.env.PDF_RENDERER;
  if (
    configured === "local" ||
    configured === "service" ||
    configured === "none"
  )
    return configured;
  if (process.env.PDF_SERVICE_URL) return "service";
  const appEnv = process.env.APP_ENV ?? "development";
  return appEnv === "development" || appEnv === "test" ? "local" : "none";
}

function footerTemplate(reference: string): string {
  const safe = reference.replace(/[<>&"']/g, "");
  return `<div style="font-family: sans-serif; font-size: 7pt; width: 100%; padding: 0 14mm; display: flex; justify-content: space-between; color: gray;"><span>${safe}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;
}

type Browser = { newPage(): Promise<Page>; close(): Promise<void> };
type Page = {
  route(
    url: string,
    handler: (route: {
      request(): { url(): string };
      abort(): Promise<void>;
      continue(): Promise<void>;
    }) => Promise<void>,
  ): Promise<void>;
  setContent(html: string, options: { waitUntil: "load" }): Promise<void>;
  evaluate<T>(fn: () => T | Promise<T>): Promise<T>;
  pdf(options: Record<string, unknown>): Promise<Buffer>;
  close(): Promise<void>;
};

let browserPromise: Promise<Browser> | null = null;

async function localBrowser(): Promise<Browser> {
  if (!browserPromise) {
    // A variable specifier keeps Playwright out of the server bundle.
    const specifier = "playwright";
    browserPromise = import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ specifier
    ).then((mod: { chromium: { launch(o: object): Promise<Browser> } }) =>
      mod.chromium.launch({ headless: true }),
    );
    browserPromise.catch(() => {
      browserPromise = null;
    });
  }
  return browserPromise;
}

/** Renders with a local Chromium. Network is blocked: fonts are embedded. */
/** `fullBleed`: no margins and no page footer (the food menu prints edge to edge). */
export type RenderOptions = { fullBleed?: boolean };

export async function renderPdfLocally(
  html: string,
  reference: string,
  options: RenderOptions = {},
): Promise<Buffer> {
  const browser = await localBrowser();
  const page = await browser.newPage();
  try {
    await page.route("**/*", (route) =>
      route.request().url().startsWith("data:")
        ? route.continue()
        : route.abort(),
    );
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready.then(() => true));
    return await page.pdf(
      options.fullBleed
        ? {
            format: "A4",
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: "0", bottom: "0", left: "0", right: "0" },
          }
        : {
            format: "A4",
            printBackground: true,
            preferCSSPageSize: true,
            displayHeaderFooter: true,
            headerTemplate: "<span></span>",
            footerTemplate: footerTemplate(reference),
            margin: {
              top: "16mm",
              bottom: "18mm",
              left: "14mm",
              right: "14mm",
            },
          },
    );
  } finally {
    await page.close();
  }
}

export function signServiceRequest(
  secret: string,
  timestamp: string,
  body: string,
): string {
  const digest = createHash("sha256").update(body).digest("hex");
  return createHmac("sha256", secret)
    .update(`${timestamp}.${digest}`)
    .digest("hex");
}

/** Calls pdf-service/ (it may take ~1 minute to wake on the free plan). */
export async function renderPdfWithService(
  html: string,
  reference: string,
  options: RenderOptions = {},
): Promise<Buffer> {
  const url = process.env.PDF_SERVICE_URL;
  const secret = process.env.PDF_SERVICE_SECRET;
  if (!url || !secret || secret.length < 32)
    throw new Error(
      "PDF_SERVICE_URL and PDF_SERVICE_SECRET (32+ characters) must be set",
    );
  const body = JSON.stringify({
    html,
    footer: footerTemplate(reference),
    fullBleed: options.fullBleed === true,
  });
  const timestamp = String(Date.now());
  const response = await fetch(new URL("/render", url), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-timestamp": timestamp,
      "x-signature": signServiceRequest(secret, timestamp, body),
    },
    body,
    signal: AbortSignal.timeout(110_000),
  });
  if (!response.ok) throw new Error(`PDF service answered ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-")
    throw new Error("PDF service returned something that isn't a PDF");
  return bytes;
}

/** Wakes a sleeping PDF service in the background when someone opens the PDF dialog. */
export function warmPdfService(): void {
  if (rendererMode() !== "service" || !process.env.PDF_SERVICE_URL) return;
  fetch(new URL("/health", process.env.PDF_SERVICE_URL), {
    signal: AbortSignal.timeout(90_000),
  }).catch(() => {});
}

export async function renderPdf(
  html: string,
  reference: string,
  options: RenderOptions = {},
): Promise<Buffer | null> {
  const mode = rendererMode();
  if (mode === "local") return renderPdfLocally(html, reference, options);
  if (mode === "service") return renderPdfWithService(html, reference, options);
  return null;
}
