import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeCandidate, manyCandidates } from "../fixtures/candidates";
import { renderWithProviders as render } from "../fixtures/render";
import { resetUrl } from "../fixtures/next-navigation";

vi.mock("next/navigation", async () => {
  const { navigation } = await import("../fixtures/next-navigation");
  return navigation;
});

/**
 * Ticket #10 — Debounce the search inputs and highlight matching text
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * You need:
 *   - `useDebouncedValue(value, delay)` from `src/lib/use-debounced-value.ts`
 *   - `Highlight` and `splitOnMatches` from `src/components/highlight.tsx`
 *   - `data-testid="search-input"` on each search field
 *   - matched text wrapped in <mark>
 *
 * `splitOnMatches` is a pure function on purpose: the interesting edge cases
 * (regex characters, casing, repeated matches) are far easier to pin down
 * without rendering anything.
 */
let useDebouncedValue: typeof import("@/lib/use-debounced-value").useDebouncedValue;
let splitOnMatches: typeof import("@/components/highlight").splitOnMatches;
let CandidatesView: typeof import("@/components/candidates/candidates-view").CandidatesView;

describe("ticket 10 — debounced search and highlighting", () => {
  beforeAll(async () => {
    ({ useDebouncedValue } = await import("@/lib/use-debounced-value"));
    ({ splitOnMatches } = await import("@/components/highlight"));
    ({ CandidatesView } = await import("@/components/candidates/candidates-view"));
  });

  describe("useDebouncedValue", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("returns the initial value straight away", () => {
      const { result } = renderHook(() => useDebouncedValue("alex", 250));
      expect(result.current).toBe("alex");
    });

    it("does not update before the delay has passed", () => {
      const { result, rerender } = renderHook(
        ({ v }) => useDebouncedValue(v, 250),
        { initialProps: { v: "alex" } }
      );
      rerender({ v: "alexa" });
      act(() => void vi.advanceTimersByTime(200));
      expect(result.current).toBe("alex");
    });

    it("updates once the delay has passed", () => {
      const { result, rerender } = renderHook(
        ({ v }) => useDebouncedValue(v, 250),
        { initialProps: { v: "alex" } }
      );
      rerender({ v: "alexa" });
      act(() => void vi.advanceTimersByTime(300));
      expect(result.current).toBe("alexa");
    });

    it("only settles on the last value when typing quickly", () => {
      const { result, rerender } = renderHook(
        ({ v }) => useDebouncedValue(v, 250),
        { initialProps: { v: "a" } }
      );
      for (const v of ["al", "ale", "alex"]) {
        rerender({ v });
        act(() => void vi.advanceTimersByTime(50));
      }
      expect(result.current).toBe("a");
      act(() => void vi.advanceTimersByTime(300));
      expect(result.current).toBe("alex");
    });

    it("clears immediately, without waiting for the delay", () => {
      const { result, rerender } = renderHook(
        ({ v }) => useDebouncedValue(v, 250),
        { initialProps: { v: "alex" } }
      );
      rerender({ v: "" });
      // Clearing the box should restore the full list at once.
      expect(result.current).toBe("");
    });
  });

  describe("splitOnMatches", () => {
    it("splits a single match into before / match / after", () => {
      expect(splitOnMatches("Nadia Fernandes", "dia")).toEqual([
        { text: "Na", match: false },
        { text: "dia", match: true },
        { text: " Fernandes", match: false },
      ]);
    });

    it("matches case-insensitively but keeps the original casing", () => {
      const parts = splitOnMatches("Nadia", "NAD");
      expect(parts[0]).toEqual({ text: "Nad", match: true });
    });

    it("finds every occurrence", () => {
      const parts = splitOnMatches("aXaXa", "x");
      expect(parts.filter((p) => p.match)).toHaveLength(2);
    });

    it("treats regex characters as literal text", () => {
      // A naive RegExp implementation throws or matches the wrong thing here.
      expect(() => splitOnMatches("a.b*c", ".")).not.toThrow();
      const parts = splitOnMatches("a.b*c", ".");
      expect(parts.filter((p) => p.match).map((p) => p.text)).toEqual(["."]);
    });

    it("does not throw on an unbalanced bracket", () => {
      expect(() => splitOnMatches("array[0]", "[")).not.toThrow();
    });

    it("returns the whole string unmatched when there is no match", () => {
      expect(splitOnMatches("Nadia", "zzz")).toEqual([
        { text: "Nadia", match: false },
      ]);
    });

    it("returns the whole string unmatched for an empty query", () => {
      expect(splitOnMatches("Nadia", "")).toEqual([
        { text: "Nadia", match: false },
      ]);
    });

    it("reassembles into the original string", () => {
      const text = "Ana Sofía Rojas";
      const parts = splitOnMatches(text, "so");
      expect(parts.map((p) => p.text).join("")).toBe(text);
    });
  });

  describe("in the candidates list", () => {
    beforeEach(() => resetUrl());

    const rows = () => {
      const body = document.querySelector('[data-slot="table-body"]')!;
      return within(body as HTMLElement).getAllByRole("row");
    };

    it("keeps the input responsive while typing", async () => {
      const user = userEvent.setup();
      render(<CandidatesView candidates={manyCandidates()} currentUserId={10} />);
      const input = screen.getByTestId("search-input");
      await user.type(input, "priya");
      // The value in the box is never delayed, even though filtering is.
      expect(input).toHaveValue("priya");
    });

    it("filters after the debounce", async () => {
      const user = userEvent.setup();
      render(<CandidatesView candidates={manyCandidates()} currentUserId={10} />);
      await user.type(screen.getByTestId("search-input"), "priya");
      await waitFor(() => expect(rows()).toHaveLength(1));
    });

    it("wraps the matching part of the name in <mark>", async () => {
      const user = userEvent.setup();
      render(<CandidatesView candidates={manyCandidates()} currentUserId={10} />);
      await user.type(screen.getByTestId("search-input"), "priya");
      await waitFor(() => expect(rows()).toHaveLength(1));

      const marks = document.querySelectorAll("mark");
      expect(marks.length).toBeGreaterThan(0);
      expect(marks[0].textContent?.toLowerCase()).toBe("priya");
    });

    it("highlights without hardcoded colours", async () => {
      const user = userEvent.setup();
      render(<CandidatesView candidates={manyCandidates()} currentUserId={10} />);
      await user.type(screen.getByTestId("search-input"), "priya");
      await waitFor(() => expect(document.querySelector("mark")).toBeTruthy());

      const mark = document.querySelector("mark")!;
      expect(mark.className).not.toMatch(/#[0-9a-f]{3,6}/i);
      expect(mark.className).not.toMatch(/\bbg-(yellow|amber|red)-\d{3}\b/);
    });

    it("renders markup in a name as text, never as HTML", async () => {
      const user = userEvent.setup();
      const nasty = "<script>alert(1)</script>";
      render(
        <CandidatesView
          candidates={[makeCandidate({ id: 1, name: nasty })]}
          currentUserId={10}
        />
      );
      await user.type(screen.getByTestId("search-input"), "script");
      await waitFor(() => expect(document.querySelector("mark")).toBeTruthy());

      // If this renders as HTML the <script> tag is in the DOM and the text is
      // gone. Highlighting must never build an HTML string.
      expect(document.querySelector("script")).toBeNull();
      expect(screen.getByText(/alert\(1\)/)).toBeInTheDocument();
    });

    it("restores the full list as soon as the box is cleared", async () => {
      const user = userEvent.setup();
      render(<CandidatesView candidates={manyCandidates()} currentUserId={10} />);
      const input = screen.getByTestId("search-input");
      await user.type(input, "priya");
      await waitFor(() => expect(rows()).toHaveLength(1));

      await user.clear(input);
      // No waitFor: clearing is not debounced.
      expect(rows()).toHaveLength(10);
    });
  });
});
