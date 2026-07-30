import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Ticket #18 — Question bank favourites and recently asked
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * Contract:
 *   - FavoriteStar renders data-testid="favorite-<id>" with aria-pressed
 *   - useRecentQuestions persists to localStorage key "ic-recent-questions"
 */

const api = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));

vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return { ...actual, api };
});
vi.mock("sonner", () => ({ toast, Toaster: () => null }));

let FavoriteStar: typeof import("@/components/bank/favorite-star").FavoriteStar;
let useRecentQuestions: typeof import("@/lib/use-recent-questions").useRecentQuestions;

const KEY = "ic-recent-questions";

describe("ticket 18 — favourites and recents", () => {
  beforeAll(async () => {
    ({ FavoriteStar } = await import("@/components/bank/favorite-star"));
    ({ useRecentQuestions } = await import("@/lib/use-recent-questions"));
  });

  beforeEach(() => {
    api.mockReset().mockResolvedValue({});
    localStorage.clear();
  });
  afterEach(() => localStorage.clear());

  describe("FavoriteStar", () => {
    it("is a toggle with a state-dependent accessible name", () => {
      render(<FavoriteStar questionId={7} initialFavorite={false} />);
      const star = screen.getByTestId("favorite-7");
      expect(star).toHaveAttribute("aria-pressed", "false");
      expect(star).toHaveAccessibleName(/star/i);
    });

    it("stars via POST and flips aria-pressed", async () => {
      const user = userEvent.setup();
      render(<FavoriteStar questionId={7} initialFavorite={false} />);
      await user.click(screen.getByTestId("favorite-7"));

      await waitFor(() =>
        expect(screen.getByTestId("favorite-7")).toHaveAttribute(
          "aria-pressed",
          "true"
        )
      );
      expect(api).toHaveBeenCalledWith(
        "/api/questions/7/favorite",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("unstars via DELETE when already a favourite", async () => {
      const user = userEvent.setup();
      render(<FavoriteStar questionId={7} initialFavorite />);
      await user.click(screen.getByTestId("favorite-7"));
      await waitFor(() =>
        expect(api).toHaveBeenCalledWith(
          "/api/questions/7/favorite",
          expect.objectContaining({ method: "DELETE" })
        )
      );
    });

    it("rolls back when the request fails", async () => {
      const user = userEvent.setup();
      api.mockRejectedValue(new Error("offline"));
      render(<FavoriteStar questionId={7} initialFavorite={false} />);
      await user.click(screen.getByTestId("favorite-7"));

      await waitFor(() =>
        expect(screen.getByTestId("favorite-7")).toHaveAttribute(
          "aria-pressed",
          "false"
        )
      );
    });
  });

  describe("useRecentQuestions", () => {
    it("starts empty", () => {
      const { result } = renderHook(() => useRecentQuestions());
      expect(result.current.recent).toEqual([]);
    });

    it("records most-recent first", () => {
      const { result } = renderHook(() => useRecentQuestions());
      act(() => result.current.record(1));
      act(() => result.current.record(2));
      expect(result.current.recent).toEqual([2, 1]);
    });

    it("de-duplicates, moving a repeat to the front", () => {
      const { result } = renderHook(() => useRecentQuestions());
      act(() => result.current.record(1));
      act(() => result.current.record(2));
      act(() => result.current.record(1));
      expect(result.current.recent).toEqual([1, 2]);
    });

    it("caps at 10", () => {
      const { result } = renderHook(() => useRecentQuestions());
      act(() => {
        for (let i = 1; i <= 15; i++) result.current.record(i);
      });
      expect(result.current.recent).toHaveLength(10);
      expect(result.current.recent[0]).toBe(15);
    });

    it("persists to localStorage under the agreed key", () => {
      const { result } = renderHook(() => useRecentQuestions());
      act(() => result.current.record(42));
      expect(JSON.parse(localStorage.getItem(KEY)!)).toContain(42);
    });

    it("survives a corrupt stored value without throwing", () => {
      localStorage.setItem(KEY, "not json {[");
      const { result } = renderHook(() => useRecentQuestions());
      expect(result.current.recent).toEqual([]);
    });
  });
});
