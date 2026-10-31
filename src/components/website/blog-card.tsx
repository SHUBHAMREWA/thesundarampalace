import { Calendar } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CmsImage } from "@/components/website/cms-image";
import { Link } from "@/i18n/navigation";
import { t } from "@/lib/i18n/localized";
import { formatDateKey } from "@/lib/time";
import type { BlogPostSummaryView } from "@/server/cms/queries";

/** One article in a list (the blog page and "More articles" under a post). */
export function BlogCard({
  post,
  locale,
  headingLevel: Heading = "h2",
}: {
  post: BlogPostSummaryView;
  locale: string;
  headingLevel?: "h2" | "h3";
}) {
  const isHindi = locale === "hi";
  return (
    <li className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-card">
      <Link href={`/blog/${post.slug}`} tabIndex={-1} aria-hidden="true">
        <CmsImage
          media={post.cover}
          locale={locale}
          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
          className="aspect-[3/2]"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
          <Badge variant="outline">{t(post.category.name, locale)}</Badge>
          {post.publishedAt && post.publishedOn ? (
            <span className="flex items-center gap-1">
              <Calendar className="size-3" aria-hidden="true" />
              <time dateTime={post.publishedAt}>
                {formatDateKey(post.publishedOn, "d MMM yyyy")}
              </time>
            </span>
          ) : null}
        </div>
        <Heading className="font-display text-xl leading-snug">
          <Link href={`/blog/${post.slug}`} className="hover:text-primary">
            {t(post.title, locale)}
          </Link>
        </Heading>
        {post.summary ? (
          <p className="line-clamp-3 text-sm text-text-muted">
            {t(post.summary, locale)}
          </p>
        ) : null}
        <Link
          href={`/blog/${post.slug}`}
          className="mt-auto text-sm font-semibold text-primary hover:underline"
        >
          {isHindi ? "पूरा लेख पढ़ें →" : "Read article →"}
        </Link>
      </div>
    </li>
  );
}
