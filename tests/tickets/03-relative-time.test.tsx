import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { fmtRelative } from "@/lib/client";
import { RelativeTime } from "@/components/relative-time";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Ticket #3 — Relative timestamps with an exact date on hover
 *
 * Remove `.skip` below and make these pass.
 *
 * You need:
 *   - `fmtRelative(value, now?)` exported from src/lib/client.ts
 *   - a `RelativeTime` component at src/components/relative-time.tsx rendering
 *     an element with data-testid="relative-time"
 *
 * Note `fmtRelative` takes an optional `now` — that's what makes it testable
 * without the result changing depending on when the suite runs.
 */
const NOW = new Date("2026-03-15T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("ticket 3 — relative timestamps", () => {
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
    // The component renders against the real clock, so build these timestamps
    // relative to now rather than the fixed NOW used above.
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
