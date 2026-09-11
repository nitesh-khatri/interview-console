import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { manyCandidates } from "../fixtures/candidates";
import { renderWithProviders as render } from "../fixtures/render";
import { resetUrl, currentSearch, history } from "../fixtures/next-navigation";

// Replaces the inert global mock from tests/setup.ts with a stateful one, so
// pushing to the URL really changes what useSearchParams() returns.
vi.mock("next/navigation", async () => {
  const { navigation } = await import("../fixtures/next-navigation");
  return navigation;
});

/**
 * Ticket #8 — Put candidates search, filters and sort in the URL
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * `next/navigation` is replaced with a stateful fake: `router.push` and
 * `router.replace` really change what `useSearchParams()` returns, and really
 * re-render. Read `tests/fixtures/next-navigation.tsx` — it also records every
 * navigation so these tests can tell push from replace.
 *
 * The parameter names are up to you, but these tests assume:
 *   q, filter, sort, dir, page
 */
let CandidatesView: typeof import("@/components/candidates/candidates-view").CandidatesView;

describe("ticket 8 — URL as state", () => {
  beforeAll(async () => {
    ({ CandidatesView } = await import("@/components/candidates/candidates-view"));
  });

  beforeEach(() => resetUrl());

  const renderView = () =>
    render(<CandidatesView candidates={manyCandidates()} currentUserId={10} />);

  const rowNames = () => {
    const body = document.querySelector('[data-slot="table-body"]')!;
    return within(body as HTMLElement)
      .getAllByRole("row")
      .map((r) => r.querySelector("a")?.textContent?.trim() ?? "");
  };

  describe("reading from the URL", () => {
    it("applies a search from the URL on first render", () => {
      resetUrl("?q=priya");
      renderView();
      expect(rowNames().join(" ")).toContain("Priya Raman");
      expect(rowNames()).toHaveLength(1);
    });

    it("applies a filter from the URL", () => {
      resetUrl("?filter=mine");
      renderView();
      // Only candidates created by user 10 — half the fixture.
      expect(rowNames().length).toBeLessThan(12);
    });

    it("applies sort and direction from the URL", () => {
      resetUrl("?sort=score&dir=desc");
      renderView();
      expect(rowNames()[0]).toContain("Priya Raman");
      expect(screen.getByTestId("sort-score").closest("th")).toHaveAttribute(
        "aria-sort",
        "descending"
      );
    });

    it("applies a page from the URL", () => {
      resetUrl("?page=2");
      renderView();
      expect(screen.getByTestId("page-next")).toBeDisabled();
    });

    it("shows the search text from the URL in the input", () => {
      resetUrl("?q=priya");
      renderView();
      expect(screen.getByTestId("search-input")).toHaveValue("priya");
    });

    it("reproduces a fully specified URL", () => {
      resetUrl("?q=engineer&filter=all&sort=score&dir=desc");
      renderView();
      const names = rowNames();
      expect(names.length).toBeGreaterThan(1);
      // Every match has "engineer" in its role, which rules Priya Raman
      // ("React Developer") out — so the top scorer here is Zara Whitfield.
      expect(names[0]).toContain("Zara Whitfield");
      expect(names.join(" ")).not.toContain("Priya Raman");
    });
  });

  describe("junk input", () => {
    it("falls back to defaults for a nonsense sort key", () => {
      resetUrl("?sort=nonsense&dir=sideways");
      renderView();
      expect(screen.getByTestId("sort-name").closest("th")).toHaveAttribute(
        "aria-sort",
        "ascending"
      );
    });

    it("does not render an empty table for a negative page", () => {
      resetUrl("?page=-4");
      renderView();
      expect(rowNames().length).toBeGreaterThan(0);
    });

    it("does not render an empty table for a page past the end", () => {
      resetUrl("?page=99");
      renderView();
      expect(rowNames().length).toBeGreaterThan(0);
    });

    it("ignores an unknown filter value", () => {
      resetUrl("?filter=wombat");
      renderView();
      expect(rowNames()).toHaveLength(10); // all 12, first page
    });
  });

  describe("writing to the URL", () => {
    it("puts the filter in the URL when it changes", async () => {
      const user = userEvent.setup();
      renderView();
      await user.click(screen.getByRole("button", { name: "Assigned to me" }));
      expect(currentSearch()).toContain("filter=assigned");
    });

    it("puts sort in the URL when a header is clicked", async () => {
      const user = userEvent.setup();
      renderView();
      await user.click(screen.getByTestId("sort-score"));
      expect(currentSearch()).toContain("sort=score");
    });

    it("puts the page in the URL", async () => {
      const user = userEvent.setup();
      renderView();
      await user.click(screen.getByTestId("page-next"));
      expect(currentSearch()).toContain("page=2");
    });

    it("puts the search in the URL after the debounce", async () => {
      const user = userEvent.setup();
      renderView();
      await user.type(screen.getByTestId("search-input"), "priya");
      await waitFor(() => expect(currentSearch()).toContain("q=priya"));
    });

    it("leaves defaults out of the URL", async () => {
      const user = userEvent.setup();
      renderView();
      // Sorting by name ascending is the default, so selecting it explicitly
      // should not litter the URL.
      await user.click(screen.getByTestId("sort-name"));
      await user.click(screen.getByTestId("sort-name"));
      expect(currentSearch()).not.toContain("sort=name");
      expect(currentSearch()).not.toContain("dir=asc");
    });

    it("starts from a clean URL", () => {
      renderView();
      expect(currentSearch()).toBe("");
    });

    it("resets to page 1 when the filter changes", async () => {
      const user = userEvent.setup();
      renderView();
      await user.click(screen.getByTestId("page-next"));
      await user.click(screen.getByRole("button", { name: "Assigned to me" }));
      expect(currentSearch()).not.toContain("page=2");
    });
  });

  describe("history", () => {
    it("pushes a history entry when the filter changes, so Back works", async () => {
      const user = userEvent.setup();
      renderView();
      await user.click(screen.getByRole("button", { name: "Added by me" }));
      expect(history.at(-1)?.type).toBe("push");
    });

    it("does not push one entry per keystroke while typing", async () => {
      const user = userEvent.setup();
      renderView();
      await user.type(screen.getByTestId("search-input"), "priya");
      await waitFor(() => expect(currentSearch()).toContain("q=priya"));

      const pushes = history.filter((h) => h.type === "push");
      expect(pushes).toHaveLength(0);
    });
  });
});
