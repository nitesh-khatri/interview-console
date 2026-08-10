import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Ticket #3 — Relative timestamps with an exact date on hover
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * You need:
 *   - `fmtRelative(value, now?)` exported from `src/lib/client.ts`
 *   - `src/components/relative-time.tsx` exporting `<RelativeTime value={...} />`
 *     which renders an element with data-testid="relative-time"
 *
 * `fmtRelative` takes an optional `now` so tests give the same answer whenever
 * they run — a function that reads the clock internally is very hard to test.
 */
let fmtRelative: typeof import("@/lib/client").fmtRelative;
let RelativeTime: typeof import("@/components/relative-time").RelativeTime;

const NOW = new Date("2026-03-15T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("ticket 3 — relative timestamps", () => {
  beforeAll(async () => {
    ({ fmtRelative } = await import("@/lib/client"));
    ({ RelativeTime } = await import("@/components/relative-time"));
  });

  describe("fmtRelative", () => {
    it("shows a dash for a missing value", () => {
      expect(fmtRelative(null, NOW)).toBe("—");
    });

    it("says 'just now' for the last few seconds", () => {
      expect(fmtRelative(ago(5 * SECOND), NOW)).toBe("just now");
    });

    it("counts minutes", () => {
      expect(fmtRelative(ago(5 * MINUTE), NOW)).toBe("5 minutes ago");
    });

    it("counts hours", () => {
      expect(fmtRelative(ago(3 * HOUR), NOW)).toBe("3 hours ago");
    });

    it("counts days", () => {
      expect(fmtRelative(ago(2 * DAY), NOW)).toBe("2 days ago");
    });

    it("uses the singular for exactly one", () => {
      expect(fmtRelative(ago(1 * DAY), NOW)).toBe("1 day ago");
      expect(fmtRelative(ago(1 * HOUR), NOW)).toBe("1 hour ago");
    });

    it("falls back to an absolute date beyond a month", () => {
      const result = fmtRelative(ago(90 * DAY), NOW);
      expect(result).not.toMatch(/ago/);
      expect(result).toMatch(/2025|Dec/);
    });

    it("understands SQLite's 'YYYY-MM-DD HH:MM:SS' format", () => {
      expect(fmtRelative("2026-03-15 09:00:00", NOW)).toBe("3 hours ago");
    });
  });

  describe("<RelativeTime />", () => {
    // The component renders against the real clock, so build these relative to
    // now rather than the fixed NOW above.
    const recently = () => new Date(Date.now() - 2 * DAY).toISOString();

    it("renders the relative text", () => {
      render(
        <TooltipProvider>
          <RelativeTime value={recently()} />
        </TooltipProvider>
      );
      expect(screen.getByTestId("relative-time")).toHaveTextContent("2 days ago");
    });

    it("keeps the machine-readable timestamp in the markup", () => {
      const value = recently();
      render(
        <TooltipProvider>
          <RelativeTime value={value} />
        </TooltipProvider>
      );
      expect(screen.getByTestId("relative-time")).toHaveAttribute("dateTime", value);
    });

    it("shows a dash when there is no timestamp", () => {
      render(
        <TooltipProvider>
          <RelativeTime value={null} />
        </TooltipProvider>
      );
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });
});
