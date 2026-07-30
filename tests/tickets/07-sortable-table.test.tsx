import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { manyCandidates, makeCandidate, makeRound } from "../fixtures/candidates";
import { renderWithProviders as render } from "../fixtures/render";
import { resetUrl } from "../fixtures/next-navigation";

// A stateful router, so this test works whether you keep sort state in
// useState or in the URL (which is ticket #8).
vi.mock("next/navigation", async () => {
  const { navigation } = await import("../fixtures/next-navigation");
  return navigation;
});

/**
 * Ticket #7 — Sortable and paginated candidates table
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * Your markup needs these hooks:
 *   data-testid="sort-name" | "sort-status" | "sort-added" | "sort-score"
 *   data-testid="page-next" | "page-prev" | "page-info"
 *   aria-sort on the <th>: "ascending" | "descending" | "none"
 *
 * This file mocks `next/navigation` with a stateful fake router, so it passes
 * whether you hold sort/page state in `useState` or in the URL. Ticket #8 moves
 * it into the URL properly — do #7 first.
 */
let CandidatesView: typeof import("@/components/candidates/candidates-view").CandidatesView;
let compareCandidates: typeof import("@/components/candidates/candidates-view").compareCandidates;
let candidateScore: typeof import("@/components/candidates/candidates-view").candidateScore;

describe("ticket 7 — sortable, paginated table", () => {
  beforeAll(async () => {
    ({ CandidatesView, compareCandidates, candidateScore } = await import(
      "@/components/candidates/candidates-view"
    ));
  });

  beforeEach(() => resetUrl());

  describe("candidateScore", () => {
    it("averages completed rounds", () => {
      const c = makeCandidate({
        rounds: [
          makeRound({ id: 1, status: "completed", question_avg: 4 }),
          makeRound({ id: 2, status: "completed", question_avg: 2 }),
        ],
      });
      expect(candidateScore(c)).toBe(3);
    });

    it("ignores rounds that are not complete", () => {
      const c = makeCandidate({
        rounds: [
          makeRound({ id: 1, status: "completed", question_avg: 4 }),
          makeRound({ id: 2, status: "in_progress", question_avg: 1 }),
        ],
      });
      expect(candidateScore(c)).toBe(4);
    });

    it("is null when nothing is scored", () => {
      const c = makeCandidate({ rounds: [] });
      expect(candidateScore(c)).toBeNull();
    });
  });

  describe("compareCandidates", () => {
    const scored = (name: string, avg: number | null) =>
      makeCandidate({
        name,
        rounds:
          avg == null
            ? []
            : [makeRound({ status: "completed", question_avg: avg })],
      });

    it("sorts names case-insensitively", () => {
      const a = scored("alex chen", 1);
      const z = scored("Zara Whitfield", 1);
      expect(compareCandidates(a, z, "name", "asc")).toBeLessThan(0);
    });

    it("reverses on descending", () => {
      const a = scored("alex chen", 1);
      const z = scored("Zara Whitfield", 1);
      expect(compareCandidates(a, z, "name", "desc")).toBeGreaterThan(0);
    });

    it("puts unscored candidates last when ascending", () => {
      const none = scored("No Score", null);
      const low = scored("Low Score", 1);
      expect(compareCandidates(none, low, "score", "asc")).toBeGreaterThan(0);
    });

    it("puts unscored candidates last when descending too", () => {
      // A missing score is not a zero — flipping the direction must not float
      // unscored candidates to the top.
      const none = scored("No Score", null);
      const high = scored("High Score", 5);
      expect(compareCandidates(none, high, "score", "desc")).toBeGreaterThan(0);
    });
  });

  describe("the table", () => {
    const renderView = () =>
      render(<CandidatesView candidates={manyCandidates()} currentUserId={10} />);

    const rowNames = () => {
      const body = document.querySelector('[data-slot="table-body"]')!;
      return within(body as HTMLElement)
        .getAllByRole("row")
        .map((r) => r.querySelector("a")?.textContent?.trim() ?? "");
    };

    it("shows 10 rows on the first page", () => {
      renderView();
      const body = document.querySelector('[data-slot="table-body"]')!;
      expect(within(body as HTMLElement).getAllByRole("row")).toHaveLength(10);
    });

    it("reports the visible range and the filtered total", () => {
      renderView();
      const info = screen.getByTestId("page-info").textContent!;
      expect(info).toMatch(/1/);
      expect(info).toMatch(/10/);
      expect(info).toMatch(/12/);
    });

    it("disables Previous on the first page rather than hiding it", () => {
      renderView();
      expect(screen.getByTestId("page-prev")).toBeDisabled();
      expect(screen.getByTestId("page-next")).toBeEnabled();
    });

    it("sorts by name ascending by default", () => {
      renderView();
      const names = rowNames();
      // "alex chen" sorts first only if the comparison ignores case.
      expect(names[0].toLowerCase()).toContain("alex chen");
    });

    it("marks the sorted column with aria-sort", () => {
      renderView();
      const nameHeader = screen.getByTestId("sort-name").closest("th");
      expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
    });

    it("leaves unsorted columns as aria-sort=none", () => {
      renderView();
      const statusHeader = screen.getByTestId("sort-status").closest("th");
      expect(statusHeader).toHaveAttribute("aria-sort", "none");
    });

    it("only sorts one column at a time", async () => {
      const user = userEvent.setup();
      renderView();
      await user.click(screen.getByTestId("sort-score"));

      const sorted = ["sort-name", "sort-status", "sort-added", "sort-score"]
        .map((id) => screen.getByTestId(id).closest("th")!)
        .filter((th) => th.getAttribute("aria-sort") !== "none");
      expect(sorted).toHaveLength(1);
    });

    it("reverses direction when the same header is clicked twice", async () => {
      const user = userEvent.setup();
      renderView();
      await user.click(screen.getByTestId("sort-score"));
      const first = rowNames();
      await user.click(screen.getByTestId("sort-score"));
      const second = rowNames();
      expect(second).not.toEqual(first);
    });

    it("keeps unscored candidates off the top when sorting by score descending", async () => {
      const user = userEvent.setup();
      renderView();
      await user.click(screen.getByTestId("sort-score")); // asc
      await user.click(screen.getByTestId("sort-score")); // desc
      // Priya Raman has the highest score (5.0); the two unscored candidates
      // must not outrank her.
      expect(rowNames()[0]).toContain("Priya Raman");
    });

    it("moves to the next page", async () => {
      const user = userEvent.setup();
      renderView();
      const firstPage = rowNames();
      await user.click(screen.getByTestId("page-next"));
      expect(rowNames()).not.toEqual(firstPage);
      expect(screen.getByTestId("page-next")).toBeDisabled();
    });

    it("returns to page 1 when the sort changes", async () => {
      const user = userEvent.setup();
      renderView();
      await user.click(screen.getByTestId("page-next"));
      await user.click(screen.getByTestId("sort-status"));
      // Landing on a page beyond the results would show an empty table.
      const body = document.querySelector('[data-slot="table-body"]')!;
      expect(
        within(body as HTMLElement).getAllByRole("row").length
      ).toBeGreaterThan(1);
      expect(screen.getByTestId("page-prev")).toBeDisabled();
    });

    it("does not mutate the candidates array it was given", async () => {
      const user = userEvent.setup();
      const candidates = manyCandidates();
      const originalOrder = candidates.map((c) => c.id);
      render(<CandidatesView candidates={candidates} currentUserId={10} />);
      await user.click(screen.getByTestId("sort-score"));
      expect(candidates.map((c) => c.id)).toEqual(originalOrder);
    });
  });
});
