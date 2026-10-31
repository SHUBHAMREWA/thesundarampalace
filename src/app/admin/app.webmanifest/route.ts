import { manifestResponse } from "@/lib/pwa/manifest";

/** Manifest for installing the staff CRM as an app (built once, static; no private data). */
export function GET() {
  return manifestResponse("crm");
}
