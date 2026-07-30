import { cn } from "@/lib/utils";

export interface Bar {
  label: string;
  value: number;
  /** 1–5, picks a --chart-* token. */
  tone?: number;
}

/**
 * Buckets completed-round averages into 0–1, 1–2, 2–3, 3–4, 4–5.
 * A 5.0 lands in the top bucket rather than falling off the end.
 * Exported so the bucketing is testable without rendering.
 */
export function scoreBuckets(averages: Array<number | null | undefined>): Bar[] {
  const labels = ["0–1", "1–2", "2–3", "3–4", "4–5"];
  const counts = [0, 0, 0, 0, 0];
  for (const a of averages) {
    if (a == null || isNaN(a)) continue;
    const clamped = Math.max(0, Math.min(5, a));
    const idx = clamped >= 5 ? 4 : Math.floor(clamped);
    counts[idx] += 1;
  }
  return labels.map((label, i) => ({ label, value: counts[i], tone: i + 1 }));
}

/** Max, guarding against divide-by-zero so one candidate doesn't blow up. */
function maxValue(bars: Bar[]): number {
  return Math.max(1, ...bars.map((b) => b.value));
}

/**
 * A vertical bar chart in plain CSS — no charting library, so it needs no
 * client component and plays nicely with the CSS-variable theming. Marked
 * `role="img"` with a text summary so a screen reader gets the numbers too.
 */
export function ScoreDistribution({ data }: { data: Bar[] }) {
  const total = data.reduce((s, b) => s + b.value, 0);
  const max = maxValue(data);

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">Score distribution</h3>
      {total === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No completed rounds yet.
        </p>
      ) : (
        <div
          data-testid="score-distribution"
          role="img"
          aria-label={
            "Score distribution: " +
            data.map((b) => `${b.value} in ${b.label}`).join(", ")
          }
          className="flex h-40 items-end gap-2"
        >
          {data.map((b) => (
            <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs tabular-nums text-muted-foreground">
                {b.value}
              </span>
              <div
                data-testid="chart-bar"
                data-value={b.value}
                className="w-full rounded-t"
                style={{
                  height: `${(b.value / max) * 100}%`,
                  minHeight: b.value > 0 ? 2 : 0,
                  backgroundColor: `var(--chart-${b.tone ?? 1})`,
                }}
              />
              <span className="text-xs text-muted-foreground">{b.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A horizontal funnel — widest stage at the top — so you can see where
 * candidates drop out. Same no-library approach.
 */
export function PipelineFunnel({ data }: { data: Bar[] }) {
  const total = data.reduce((s, b) => s + b.value, 0);
  const max = maxValue(data);

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">Pipeline</h3>
      {total === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No candidates yet.
        </p>
      ) : (
        <div
          data-testid="pipeline-funnel"
          role="img"
          aria-label={
            "Pipeline: " + data.map((b) => `${b.value} at ${b.label}`).join(", ")
          }
          className="space-y-2"
        >
          {data.map((b, i) => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
                {b.label}
              </span>
              <div className="h-6 flex-1 rounded bg-muted/40">
                <div
                  data-testid="chart-bar"
                  data-value={b.value}
                  className={cn(
                    "flex h-6 items-center justify-end rounded px-2 text-xs font-medium tabular-nums text-primary-foreground"
                  )}
                  style={{
                    width: `${Math.max((b.value / max) * 100, b.value > 0 ? 8 : 0)}%`,
                    backgroundColor: `var(--chart-${(i % 5) + 1})`,
                  }}
                >
                  {b.value > 0 ? b.value : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
