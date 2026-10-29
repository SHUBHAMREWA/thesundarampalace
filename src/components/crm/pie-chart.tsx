import { formatINR } from "@/lib/money";

/** Slice colours: Rose Mahal tokens only (sundaram-design-system). */
const COLORS = [
  "var(--color-primary)",
  "var(--color-gold)",
  "var(--color-lavender)",
  "var(--color-info)",
  "var(--color-success)",
  "var(--color-border-strong)",
];

/**
 * Donut chart drawn as SVG on the server: no chart library, no JavaScript.
 * The legend lists every value, so the chart is readable without colour.
 */
export function PieChart({ slices, money = false, label }: { slices: { label: string; value: number }[]; money?: boolean; label: string }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const format = (v: number) => (money ? formatINR(String(v)) : v.toLocaleString("en-IN"));
  if (!total) return <p className="py-10 text-center text-sm text-text-muted">Nothing in this period.</p>;

  const radius = 15.915; // circumference ≈ 100, so dash lengths are percentages
  const percents = slices.map((s) => (s.value / total) * 100);
  // Each slice starts where the previous ones end, beginning at 12 o'clock.
  const offsets = percents.map((_, i) => 25 - percents.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg viewBox="0 0 42 42" className="size-40 shrink-0" role="img" aria-label={label}>
        <circle cx="21" cy="21" r={radius} fill="none" stroke="var(--color-blush)" strokeWidth="7" />
        {slices.map((s, i) => (
          <circle
            key={s.label}
            cx="21"
            cy="21"
            r={radius}
            fill="none"
            stroke={COLORS[i % COLORS.length]}
            strokeWidth="7"
            strokeDasharray={`${percents[i]} ${100 - percents[i]}`}
            strokeDashoffset={offsets[i]}
          />
        ))}
      </svg>
      <ul className="w-full space-y-1.5 text-sm">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span className="size-3 shrink-0 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} aria-hidden="true" />
              {s.label}
            </span>
            <span className="whitespace-nowrap text-text-muted">
              {format(s.value)} · {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
