import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Ticket #1 — Loading skeletons and an error boundary
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * You need to create:
 *   - src/app/(app)/candidates/loading.tsx
 *   - src/app/(app)/dashboard/loading.tsx
 *   - src/app/(app)/question-bank/loading.tsx
 *   - src/app/(app)/error.tsx   (client component, uses the reset() prop)
 *
 * Next.js renders loading.tsx automatically while a page fetches its data, and
 * error.tsx when a page throws.
 */
let CandidatesLoading: React.ComponentType;
let DashboardLoading: React.ComponentType;
let QuestionBankLoading: React.ComponentType;
let ErrorBoundary: React.ComponentType<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

describe("ticket 1 — loading and error states", () => {
  beforeAll(async () => {
    CandidatesLoading = (await import("@/app/(app)/candidates/loading")).default;
    DashboardLoading = (await import("@/app/(app)/dashboard/loading")).default;
    QuestionBankLoading = (await import("@/app/(app)/question-bank/loading")).default;
    ErrorBoundary = (await import("@/app/(app)/error")).default;
  });

  describe("loading states", () => {
    /** Skeletons are decorative divs, so look for the shadcn Skeleton class. */
    const skeletonCount = (container: HTMLElement) =>
      container.querySelectorAll('[data-slot="skeleton"], .animate-pulse').length;

    it("candidates shows placeholders", () => {
      const { container } = render(<CandidatesLoading />);
      expect(skeletonCount(container)).toBeGreaterThan(3);
    });

    it("dashboard shows placeholders", () => {
      const { container } = render(<DashboardLoading />);
      expect(skeletonCount(container)).toBeGreaterThan(3);
    });

    it("question bank shows placeholders", () => {
      const { container } = render(<QuestionBankLoading />);
      expect(skeletonCount(container)).toBeGreaterThan(3);
    });

    it("uses theme tokens, not hardcoded colours", () => {
      const { container } = render(<CandidatesLoading />);
      expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i);
      expect(container.innerHTML).not.toMatch(/\bbg-(gray|slate|zinc)-\d{3}\b/);
    });
  });

  describe("error boundary", () => {
    it("tells the user something went wrong", () => {
      render(<ErrorBoundary error={new Error("boom")} reset={vi.fn()} />);
      expect(screen.getByText(/went wrong/i)).toBeInTheDocument();
    });

    it("calls reset() when the retry button is clicked", async () => {
      const user = userEvent.setup();
      const reset = vi.fn();
      render(<ErrorBoundary error={new Error("boom")} reset={reset} />);

      await user.click(screen.getByRole("button", { name: /try again/i }));
      expect(reset).toHaveBeenCalledOnce();
    });
  });
});
