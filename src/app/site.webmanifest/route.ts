import { manifestResponse } from "@/lib/pwa/manifest";

/** Manifest for installing the public website as an app (built once, static). */
export function GET() {
  return manifestResponse("website");
}
