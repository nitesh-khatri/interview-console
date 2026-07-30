import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Ticket #12 — Autosave status indicator
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * You need:
 *   - `useDebouncedSave` to also report a `status` and expose a `retry()`
 *   - `combineSaveStatus(statuses)` — one answer from several savers
 *   - an indicator with data-testid="save-status" and
 *     data-status="idle" | "saving" | "saved" | "error"
 *   - a retry control with data-testid="save-retry" when it has failed
 *
 * The hook tests use fake timers so the debounce is under your control. Note
 * that the saver must let its rejection through: if you catch the error inside
 * the save function, the hook can never know the write failed.
 */
type Mod = typeof import("@/lib/use-debounced-save");
let useDebouncedSave: Mod["useDebouncedSave"];
let combineSaveStatus: Mod["combineSaveStatus"];
let SaveStatusIndicator: typeof import("@/components/console/save-status").SaveStatusIndicator;

describe("ticket 12 — autosave indicator", () => {
  beforeAll(async () => {
    ({ useDebouncedSave, combineSaveStatus } = await import(
      "@/lib/use-debounced-save"
    ));
    ({ SaveStatusIndicator } = await import(
      "@/components/console/save-status"
    ));
  });

  describe("combineSaveStatus", () => {
    it("is idle when nothing has happened", () => {
      expect(combineSaveStatus(["idle", "idle"])).toBe("idle");
    });

    it("is saved when everything is saved", () => {
      expect(combineSaveStatus(["saved", "idle", "saved"])).toBe("saved");
    });

    it("is saving while any save is in flight", () => {
      expect(combineSaveStatus(["saved", "saving", "idle"])).toBe("saving");
    });

    it("reports an error even when something else succeeded", () => {
      // Pessimistic on purpose: the failure is the part that loses data.
      expect(combineSaveStatus(["saved", "error", "saving"])).toBe("error");
    });
  });

  describe("useDebouncedSave status", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("starts idle, before anything is typed", () => {
      const { result } = renderHook(() => useDebouncedSave(vi.fn(), 300));
      // A freshly opened round must not claim anything has been saved.
      expect(result.current.status).toBe("idle");
    });

    it("goes to saving as soon as an edit is queued", () => {
      const { result } = renderHook(() => useDebouncedSave(vi.fn(), 300));
      act(() => result.current.trigger("notes", "hello"));
      expect(result.current.status).toBe("saving");
    });

    it("reaches saved once the write resolves", async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useDebouncedSave(save, 300));

      act(() => result.current.trigger("notes", "hello"));
      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      expect(save).toHaveBeenCalledWith("notes", "hello");
      expect(result.current.status).toBe("saved");
    });

    it("reaches error when the write rejects", async () => {
      const save = vi.fn().mockRejectedValue(new Error("offline"));
      const { result } = renderHook(() => useDebouncedSave(save, 300));

      act(() => result.current.trigger("notes", "hello"));
      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      expect(result.current.status).toBe("error");
    });

    it("stays in error until a retry succeeds", async () => {
      const save = vi.fn().mockRejectedValue(new Error("offline"));
      const { result } = renderHook(() => useDebouncedSave(save, 300));

      act(() => result.current.trigger("notes", "hello"));
      await act(async () => {
        vi.advanceTimersByTime(400);
      });
      expect(result.current.status).toBe("error");

      // It must not quietly drift back to "saved".
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(result.current.status).toBe("error");
    });

    it("retry re-sends the edit that failed, not an empty request", async () => {
      const save = vi
        .fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValue(undefined);
      const { result } = renderHook(() => useDebouncedSave(save, 300));

      act(() => result.current.trigger("notes", "the real note"));
      await act(async () => {
        vi.advanceTimersByTime(400);
      });
      expect(result.current.status).toBe("error");

      await act(async () => {
        await result.current.retry();
      });

      expect(save).toHaveBeenLastCalledWith("notes", "the real note");
      expect(result.current.status).toBe("saved");
    });

    it("two quick edits do not leave a stuck 'saving'", async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useDebouncedSave(save, 300));

      act(() => result.current.trigger("notes", "a"));
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      act(() => result.current.trigger("notes", "ab"));
      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      expect(result.current.status).toBe("saved");
      // Debounced, so only the final value is written.
      expect(save).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith("notes", "ab");
    });

    it("still flushes pending saves, which completing a round depends on", async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useDebouncedSave(save, 600));

      act(() => result.current.trigger("notes", "typed just now"));
      await act(async () => {
        await result.current.flush();
      });

      expect(save).toHaveBeenCalledWith("notes", "typed just now");
    });
  });

  describe("<SaveStatusIndicator />", () => {
    it("renders nothing visible when idle", () => {
      render(<SaveStatusIndicator status="idle" onRetry={vi.fn()} />);
      const el = screen.getByTestId("save-status");
      expect(el).toHaveAttribute("data-status", "idle");
      expect(el.textContent?.trim()).toBe("");
    });

    it("says it is saving", () => {
      render(<SaveStatusIndicator status="saving" onRetry={vi.fn()} />);
      expect(screen.getByTestId("save-status")).toHaveTextContent(/saving/i);
    });

    it("says it saved", () => {
      render(<SaveStatusIndicator status="saved" onRetry={vi.fn()} />);
      expect(screen.getByTestId("save-status")).toHaveTextContent(/saved/i);
    });

    it("says it did not save, and offers a retry", () => {
      render(<SaveStatusIndicator status="error" onRetry={vi.fn()} />);
      expect(screen.getByTestId("save-status")).toHaveTextContent(/not saved/i);
      expect(screen.getByTestId("save-retry")).toBeInTheDocument();
    });

    it("calls onRetry when the retry is clicked", async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      render(<SaveStatusIndicator status="error" onRetry={onRetry} />);
      await user.click(screen.getByTestId("save-retry"));
      expect(onRetry).toHaveBeenCalledOnce();
    });

    it("announces changes politely", () => {
      render(<SaveStatusIndicator status="saving" onRetry={vi.fn()} />);
      expect(screen.getByTestId("save-status")).toHaveAttribute(
        "aria-live",
        "polite"
      );
    });

    it("uses theme tokens rather than literal red and green", () => {
      const { container } = render(
        <SaveStatusIndicator status="error" onRetry={vi.fn()} />
      );
      expect(container.innerHTML).not.toMatch(/\btext-red-\d{3}\b/);
      expect(container.innerHTML).not.toMatch(/\btext-green-\d{3}\b/);
      expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i);
    });
  });
});
