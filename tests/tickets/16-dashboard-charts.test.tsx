import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Ticket #16 — Dashboard charts
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * Contract:
 *   - data-testid="score-distribution" and data-testid="pipeline-funnel"
 *   - each has role="img" and a meaningful aria-label
 *   - each bar has data-testid="chart-bar" with data-value on it
 *
 * The bucketing is a pure exported function so it's testable without rendering.
 * These tests assume `ScoreDistribution`, `PipelineFunnel` and `scoreBuckets`
 * from src/components/dashboard/charts.tsx — rename the imports if you named
 * them differently.
 */
type Mod = typeof import("@/components/dashboard/charts");
let ScoreDistribution: Mod["ScoreDistribution"];
let PipelineFunnel: Mod["PipelineFunnel"];
let scoreBuckets: Mod["scoreBuckets"];

describe("ticket 16 — dashboard charts", () => {
  beforeAll(async () => {
    ({ ScoreDistribution, PipelineFunnel, scoreBuckets } = await import(
      "@/components/dashboard/charts"
    ));
  });

  describe("scoreBuckets", () => {
    it("buckets averages into five ranges", () => {
      const bars = scoreBuckets([0.5, 1.2, 2.9, 3.1, 4.8]);
      expect(bars.map((b) => b.value)).toEqual([1, 1, 1, 1, 1]);
    });

    it("puts a perfect 5 in the top bucket, not off the end", () => {
      const bars = scoreBuckets([5]);
      expect(bars[4].value).toBe(1);
    });

    it("ignores null and NaN", () => {
      const bars = scoreBuckets([null, undefined, NaN, 3]);
      expect(bars.reduce((s, b) => s + b.value, 0)).toBe(1);
    });

    it("returns five buckets even with no data", () => {
      expect(scoreBuckets([])).toHaveLength(5);
    });
  });

  describe("ScoreDistribution", () => {
    it("renders as an accessible image", () => {
      const data = scoreBuckets([3, 3, 4]);
      render(<ScoreDistribution data={data} />);
      const chart = screen.getByTestId("score-distribution");
      expect(chart).toHaveAttribute("role", "img");
      expect(chart.getAttribute("aria-label")?.length ?? 0).toBeGreaterThan(0);
    });

    it("puts the numeric value on each bar", () => {
      render(<ScoreDistribution data={scoreBuckets([3, 3, 4])} />);
      const bars = screen.getAllByTestId("chart-bar");
      expect(bars).toHaveLength(5);
      expect(bars.every((b) => b.hasAttribute("data-value"))).toBe(true);
    });

    it("shows an empty state rather than a broken axis with no data", () => {
      render(<ScoreDistribution data={scoreBuckets([])} />);
      expect(screen.queryByTestId("chart-bar")).not.toBeInTheDocument();
      expect(screen.getByText(/no completed rounds/i)).toBeInTheDocument();
    });

    it("does not divide by zero with a single candidate", () => {
      // One value in one bucket — the tallest bar should be full height, no NaN.
      const single = scoreBuckets([4]);
      const { container } = render(<ScoreDistribution data={single} />);
      expect(container.innerHTML).not.toMatch(/NaN/);
    });

    it("colours bars with chart tokens, not hardcoded hex", () => {
      const { container } = render(<ScoreDistribution data={scoreBuckets([3, 3, 4])} />);
      expect(container.innerHTML).toMatch(/var\(--chart-/);
    });
  });

  describe("PipelineFunnel", () => {
    const data = [
      { label: "Total", value: 12 },
      { label: "In process", value: 5 },
      { label: "Selected", value: 3 },
    ];

    it("renders as an accessible image with a bar per stage", () => {
      render(<PipelineFunnel data={data} />);
      const chart = screen.getByTestId("pipeline-funnel");
      expect(chart).toHaveAttribute("role", "img");
      expect(screen.getAllByTestId("chart-bar")).toHaveLength(3);
    });

    it("shows an empty state with no candidates", () => {
      render(
        <PipelineFunnel
          data={[
            { label: "Total", value: 0 },
            { label: "Selected", value: 0 },
          ]}
        />
      );
      expect(screen.queryByTestId("chart-bar")).not.toBeInTheDocument();
    });
  });
});
