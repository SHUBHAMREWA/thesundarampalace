import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Shown when a page or list has no CMS content yet — never invented copy. */
export async function ContentPlaceholder({ kind = "content" }: { kind?: "content" | "list" }) {
  const [tr, cta] = await Promise.all([getTranslations("placeholder"), getTranslations("cta")]);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-lg border border-border bg-surface px-6 py-12 text-center shadow-card">
      <span className="gold-rule" aria-hidden="true" />
      <p className="text-body-lg mt-5 text-text-muted">{tr(kind)}</p>
      {kind === "content" ? (
        <Button asChild className="mt-6">
          <Link href="/plan-your-event">{cta("planEvent")}</Link>
        </Button>
      ) : null}
    </div>
  );
}
