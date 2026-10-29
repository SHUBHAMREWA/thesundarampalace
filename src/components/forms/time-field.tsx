"use client";

import { Clock } from "lucide-react";
import { Popover } from "radix-ui";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Field, useFieldError } from "./form-kit";

type Parts = { hour: number; minute: number; pm: boolean };

/** "19:30" → 7:30 PM. */
function parse(value: string): Parts | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  return { hour: h % 12 || 12, minute: Number(m[2]), pm: h >= 12 };
}

/** 7:30 PM → "19:30" (what the server reads). */
function toValue({ hour, minute, pm }: Parts): string {
  const h = (hour % 12) + (pm ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

/** Number positions around the dial (12 o'clock first, clockwise). */
function dialPoint(index: number, radius: number) {
  const angle = (index / 12) * 2 * Math.PI - Math.PI / 2;
  return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) };
}

/**
 * 12-hour clock picker: choose the hour on the dial, then the minutes, then
 * AM or PM. Submits "HH:mm" (24-hour) in a hidden input named `name`.
 */
export function TimeField({
  name,
  label,
  defaultValue,
  hint,
  error,
  className,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  hint?: string;
  error?: string;
  className?: string;
}) {
  error = useFieldError(name, error);
  const id = `f${useId()}${name}`;
  const [parts, setParts] = useState<Parts | null>(() =>
    parse(defaultValue ?? ""),
  );
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"hour" | "minute">("hour");
  const draft = parts ?? { hour: 12, minute: 0, pm: true };
  const set = (patch: Partial<Parts>) => setParts({ ...draft, ...patch });

  const selectedIndex =
    mode === "hour" ? HOURS.indexOf(draft.hour) : draft.minute / 5;
  const hand =
    Number.isInteger(selectedIndex) && selectedIndex >= 0
      ? dialPoint(selectedIndex, 36)
      : null;

  return (
    <Field
      label={label}
      htmlFor={id}
      error={error}
      hint={hint}
      className={className}
    >
      <input type="hidden" name={name} value={parts ? toValue(parts) : ""} />
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setMode("hour");
        }}
      >
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            aria-describedby={
              error ? `${id}-error` : hint ? `${id}-hint` : undefined
            }
            className={cn(
              "flex h-9 w-full items-center justify-between rounded-md border border-input bg-surface px-3 text-left text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
              error && "border-destructive",
            )}
          >
            <span className={parts ? undefined : "text-text-muted"}>
              {parts
                ? `${parts.hour}:${pad(parts.minute)} ${parts.pm ? "PM" : "AM"}`
                : "Choose time"}
            </span>
            <Clock className="size-4 text-text-muted" aria-hidden="true" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={12}
            className="z-50 w-64 rounded-xl border border-border bg-surface p-3 shadow-lg"
            aria-label={`${label}: choose the time`}
          >
            {/* Read-out: tap the hour or minutes to change that part; AM/PM beside it. */}
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-baseline text-3xl font-semibold tabular-nums">
                <button
                  type="button"
                  onClick={() => setMode("hour")}
                  aria-pressed={mode === "hour"}
                  className={cn(
                    "rounded-md px-1.5",
                    mode === "hour"
                      ? "bg-blush text-primary"
                      : "text-text-muted hover:text-foreground",
                  )}
                >
                  {pad(draft.hour)}
                </button>
                <span className="text-text-muted">:</span>
                <button
                  type="button"
                  onClick={() => setMode("minute")}
                  aria-pressed={mode === "minute"}
                  className={cn(
                    "rounded-md px-1.5",
                    mode === "minute"
                      ? "bg-blush text-primary"
                      : "text-text-muted hover:text-foreground",
                  )}
                >
                  {pad(draft.minute)}
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {[false, true].map((pm) => (
                  <button
                    key={String(pm)}
                    type="button"
                    onClick={() => set({ pm })}
                    aria-pressed={draft.pm === pm}
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-xs font-semibold",
                      draft.pm === pm
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-text-muted hover:border-primary",
                    )}
                  >
                    {pm ? "PM" : "AM"}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-text-muted">
              {mode === "hour" ? "Choose the hour" : "Choose the minutes"}
            </p>

            <div className="relative mx-auto mt-2 aspect-square w-48 rounded-full bg-blush/50">
              <svg
                viewBox="0 0 100 100"
                className="pointer-events-none absolute inset-0 size-full"
                aria-hidden="true"
              >
                <circle cx="50" cy="50" r="1.6" className="fill-primary" />
                {hand ? (
                  <line
                    x1="50"
                    y1="50"
                    x2={hand.x}
                    y2={hand.y}
                    strokeWidth="0.8"
                    className="stroke-primary"
                  />
                ) : null}
              </svg>
              {(mode === "hour" ? HOURS : MINUTES).map((n, i) => {
                const p = dialPoint(i, 40);
                const active = i === selectedIndex;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      if (mode === "hour") {
                        set({ hour: n });
                        setMode("minute");
                      } else set({ minute: n });
                    }}
                    aria-label={
                      mode === "hour" ? `${n} o'clock` : `${pad(n)} minutes`
                    }
                    aria-pressed={active}
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                    className={cn(
                      "absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm tabular-nums transition-colors",
                      active
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "hover:bg-blush",
                    )}
                  >
                    {mode === "hour" ? n : pad(n)}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setParts(null)}
              >
                Clear
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (!parts) setParts(draft);
                  setOpen(false);
                }}
              >
                Done
              </Button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </Field>
  );
}
