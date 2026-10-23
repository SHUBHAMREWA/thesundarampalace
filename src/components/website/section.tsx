import type { ReactNode } from "react";

import { Container } from "@/components/layout/container";
import { cn } from "@/lib/utils";

type Tone = "ivory" | "white" | "blush" | "deep";

const toneClass: Record<Tone, string> = {
  ivory: "bg-bg",
  white: "bg-surface",
  blush: "bg-blush/50",
  deep: "bg-primary-deep text-primary-foreground",
};

/** Website section with the Rose Mahal vertical rhythm (64px mobile, 96–112px desktop). */
export function Section({
  id,
  tone = "ivory",
  className,
  children,
  labelledBy,
}: {
  id?: string;
  tone?: Tone;
  className?: string;
  children: ReactNode;
  labelledBy?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("py-16 md:py-28", toneClass[tone], className)}>
      <Container>{children}</Container>
    </section>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  intro,
  align = "center",
  as: Heading = "h2",
  tone = "light",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  intro?: string;
  align?: "center" | "left";
  as?: "h1" | "h2";
  tone?: "light" | "dark";
}) {
  return (
    <div className={cn("mb-10 flex flex-col md:mb-14", align === "center" ? "items-center text-center" : "items-start")}>
      {eyebrow ? (
        <p className={cn("text-xs font-medium tracking-[0.2em] uppercase", tone === "dark" ? "text-blush" : "text-primary")}>
          {eyebrow}
        </p>
      ) : null}
      <span className="gold-rule mt-3" aria-hidden="true" />
      <Heading id={id} className={cn("mt-5", Heading === "h1" ? "text-display-1" : "text-display-2")}>
        {title}
      </Heading>
      {intro ? (
        <p className={cn("text-body-lg mt-4 max-w-2xl", tone === "dark" ? "text-blush" : "text-text-muted")}>{intro}</p>
      ) : null}
    </div>
  );
}
