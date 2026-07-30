"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A 0–5 score selector as a real radiogroup (ticket #21): one tab stop for the
 * whole control, arrow keys move between options, and the chosen one is exposed
 * to assistive tech via `aria-checked`. This is the "roving tabindex" pattern —
 * only the active option is in the tab order.
 *
 * Clicking the already-selected score clears it (back to unscored).
 */
export function ScoreButtons({
  value,
  onChange,
  disabled,
  size = "md",
  label = "Score",
}: {
  value: number | null;
  onChange: (score: number | null) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  label?: string;
}) {
  const dim = size === "sm" ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm";
  const options = [0, 1, 2, 3, 4, 5];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // The option the arrow keys start from: the selected one, or 0 if unscored.
  const focusIndex = value ?? 0;

  function moveFocus(next: number) {
    const clamped = Math.max(0, Math.min(5, next));
    refs.current[clamped]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent, n: number) {
    if (disabled) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      moveFocus(n + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      moveFocus(n - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      moveFocus(0);
    } else if (e.key === "End") {
      e.preventDefault();
      moveFocus(5);
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex items-center gap-1"
    >
      {options.map((n) => {
        const active = value === n;
        const tone = active
          ? n >= 4
            ? "bg-success text-success-foreground border-success"
            : n >= 2.5
              ? "bg-warning text-warning-foreground border-warning"
              : "bg-destructive text-destructive-foreground border-destructive"
          : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground";
        return (
          <button
            key={n}
            ref={(el) => {
              refs.current[n] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`Score ${n}`}
            // Roving tabindex: only one option is tabbable at a time.
            tabIndex={n === focusIndex ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(active ? null : n)}
            onKeyDown={(e) => onKeyDown(e, n)}
            className={cn(
              "flex items-center justify-center rounded-md border font-semibold tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              dim,
              tone
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
