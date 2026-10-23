// Minimal HTML → PDF service for The Sundaram Palace (architecture.md ADR-08).
//
// - POST /render  { html, footer }  → application/pdf
// - GET  /health                     → "ok" (used to wake the free instance)
//
// Every /render request must be signed by the app with PDF_SERVICE_SECRET:
//   x-timestamp: <ms since epoch>, x-signature: hex(HMAC-SHA256(secret, `${timestamp}.${sha256(body)}`))
// Requests older than 5 minutes are refused. The service has no database
// access, keeps nothing on disk, and blocks every network request while
// rendering (fonts are embedded in the HTML as data: URLs).
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

import { chromium } from "playwright";

const SECRET = process.env.PDF_SERVICE_SECRET ?? "";
const PORT = Number(process.env.PORT ?? 8080);
const MAX_BODY = 8 * 1024 * 1024;
const MAX_AGE_MS = 5 * 60 * 1000;

if (SECRET.length < 32) {
  console.error("PDF_SERVICE_SECRET must be at least 32 characters.");
  process.exit(1);
}

let browserPromise = null;
function browser() {
  browserPromise ??= chromium.launch({ headless: true, args: ["--no-sandbox"] }).catch((error) => {
    browserPromise = null;
    throw error;
  });
  return browserPromise;
}

function verify(timestamp, signature, body) {
  const age = Math.abs(Date.now() - Number(timestamp));
  if (!timestamp || !Number.isFinite(age) || age > MAX_AGE_MS) return false;
  const digest = createHash("sha256").update(body).digest("hex");
  const expected = createHmac("sha256", SECRET).update(`${timestamp}.${digest}`).digest();
  const given = Buffer.from(String(signature ?? ""), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function render(html, footer) {
  const page = await (await browser()).newPage();
  try {
    await page.route("**/*", (route) => (route.request().url().startsWith("data:") ? route.continue() : route.abort()));
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready.then(() => true));
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: typeof footer === "string" ? footer : "<span></span>",
      margin: { top: "16mm", bottom: "18mm", left: "14mm", right: "14mm" },
    });
  } finally {
    await page.close();
  }
}

createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" }).end("ok");
    return;
  }
  if (req.method !== "POST" || req.url !== "/render") {
    res.writeHead(404).end();
    return;
  }
  const chunks = [];
  let size = 0;
  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY) {
      res.writeHead(413).end();
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", async () => {
    if (res.writableEnded) return;
    const body = Buffer.concat(chunks).toString("utf8");
    if (!verify(req.headers["x-timestamp"], req.headers["x-signature"], body)) {
      res.writeHead(401).end();
      return;
    }
    try {
      const { html, footer } = JSON.parse(body);
      if (typeof html !== "string" || !html.startsWith("<!doctype html>")) {
        res.writeHead(400).end();
        return;
      }
      const pdf = await render(html, footer);
      res.writeHead(200, { "content-type": "application/pdf", "cache-control": "no-store" }).end(pdf);
    } catch (error) {
      console.error("render failed", error instanceof Error ? error.message : error);
      res.writeHead(500).end();
    }
  });
}).listen(PORT, () => console.log(`pdf-service listening on ${PORT}`));
