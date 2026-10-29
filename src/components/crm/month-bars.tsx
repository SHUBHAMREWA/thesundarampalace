import { formatINR } from "@/lib/money";
import { formatDateKey } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * Grouped monthly bars drawn in plain HTML on the server (no chart library).
 * Two series on one axis; each month's group shows its exact values on hover
 * and focus, and the page also lists every number in a table.
 */

export type BarSeries = { key: string; label: string; className: string };

const SERIES_SWATCH = "inline-block size-2.5 rounded-sm";

/** Rounds the top of the axis up to a tidy number (1, 2, 2.5 or 5 × 10ⁿ). */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= value)!;
  return step * power;
}

const compact = (v: number) =>
  v >= 1e7 ? `₹${(v / 1e7).toFixed(v % 1e7 ? 1 : 0)} Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(v % 1e5 ? 1 : 0)} L` : v >= 1e3 ? `₹${Math.round(v / 1e3)}k` : `₹${v}`;

export function MonthBars({ months, series, label }: { months: { month: string; values: Record<string, number> }[]; series: BarSeries[]; label: string }) {
  const max = niceMax(Math.max(0, ...months.flatMap((m) => series.map((s) => m.values[s.key] ?? 0))));
  const ticks = [1, 0.5, 0];
  if (!months.some((m) => series.some((s) => m.values[s.key]))) {
    return <p className="py-10 text-center text-sm text-text-muted">Nothing in this period.</p>;
  }
  return (
    <figure aria-label={label} className="space-y-3">
      <ul className="flex flex-wrap gap-4 text-xs text-text-muted" aria-label="Legend">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className={cn(SERIES_SWATCH, s.className)} aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <div className="relative w-12 shrink-0 text-right text-[11px] text-text-muted" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - t) * 100}%` }}>
              {compact(max * t)}
            </span>
          ))}
        </div>
        <div className="relative h-56 flex-1 overflow-x-auto">
          {ticks.map((t) => (
            <span key={t} className="absolute inset-x-0 border-t border-border" style={{ top: `${(1 - t) * 100}%` }} aria-hidden="true" />
          ))}
          <div className="relative flex h-full min-w-fit items-end gap-1">
            {months.map((m) => {
              const summary = `${formatDateKey(`${m.month}-01`, "MMM yyyy")}: ${series.map((s) => `${s.label} ${formatINR(String(m.values[s.key] ?? 0))}`).join(", ")}`;
              return (
                <div
                  key={m.month}
                  tabIndex={0}
                  title={summary}
                  aria-label={summary}
                  className="group flex h-full min-w-10 flex-1 items-end justify-center gap-0.5 rounded-sm px-1 outline-none hover:bg-blush/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {series.map((s) => (
                    <span
                      key={s.key}
                      className={cn("w-full max-w-5 rounded-t", s.className)}
                      style={{ height: `${((m.values[s.key] ?? 0) / max) * 100}%` }}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex gap-2 pl-14 text-[11px] text-text-muted" aria-hidden="true">
        {months.map((m) => (
          <span key={m.month} className="min-w-10 flex-1 text-center">
            {formatDateKey(`${m.month}-01`, months.length > 12 ? "MMM yy" : "MMM")}
          </span>
        ))}
      </div>
    </figure>
  );
}
