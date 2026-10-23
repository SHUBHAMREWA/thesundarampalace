import type { ReactNode } from "react";

/** Centred card used by sign-in and two-factor screens. */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-lg bg-surface p-8 shadow-card">
        <p className="font-display text-xl font-semibold text-primary">The Sundaram Palace</p>
        <span className="gold-rule mt-3" aria-hidden="true" />
        <h1 className="mt-6 text-xl font-semibold">{title}</h1>
        {description ? <p className="mt-2 text-sm text-text-muted">{description}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
