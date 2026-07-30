import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders as render } from "../fixtures/render";
import { consoleProps } from "../fixtures/console";

/**
 * Ticket #13 — Optimistic updates never roll back
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * Several of these fail on today's code and pass once it's fixed.
 *
 * `api()` is mocked so a test can make the server reject. That is the whole
 * point: the console updates local state first and then fires the request, so
 * when the request fails the screen is left showing something that was never
 * recorded about the candidate.
 */

const api = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return { ...actual, api };
});

vi.mock("sonner", () => ({ toast, Toaster: () => null }));

let InterviewConsole: typeof import("@/components/console/interview-console").InterviewConsole;

describe("ticket 13 — optimistic updates roll back", () => {
  beforeAll(async () => {
    ({ InterviewConsole } = await import(
      "@/components/console/interview-console"
    ));
  });

  beforeEach(() => {
    api.mockReset();
    toast.error.mockReset();
    toast.info.mockReset();
  });

  const renderConsole = (over: Record<string, unknown> = {}) =>
    render(<InterviewConsole {...(consoleProps(over) as never)} />);

  /**
   * Question cards carry data-testid="asked-question-<id>"; the fixture's ids
   * are 1, 2 and 3 in display order.
   */
  const card = (id: number) => screen.getByTestId(`asked-question-${id}`);

  /** The score buttons for one asked question, in order 0–5. */
  const scoreButtons = (id: number) =>
    within(card(id)).getAllByRole("button", { name: /^Score [0-5]$/ });

  /** Which score is currently marked as chosen, or null if unscored. */
  const chosenScore = (id: number) => {
    const pressed = scoreButtons(id).find((b) => isSelected(b));
    return pressed?.textContent?.trim() ?? null;
  };

  /** Selected-ness, however the implementation chooses to express it. */
  const isSelected = (b: HTMLElement) =>
    b.getAttribute("aria-pressed") === "true" ||
    b.getAttribute("aria-checked") === "true" ||
    b.dataset.selected === "true";

  describe("scoring", () => {
    it("keeps the new score when the write succeeds", async () => {
      const user = userEvent.setup();
      api.mockResolvedValue({});
      renderConsole();

      await user.click(scoreButtons(2)[5]);
      await waitFor(() => expect(api).toHaveBeenCalled());
      expect(chosenScore(2)).toBe("5");
    });

    it("rolls a failed score change back to the previous value", async () => {
      const user = userEvent.setup();
      api.mockRejectedValue(new Error("offline"));
      renderConsole();

      // This question starts on 3.
      expect(chosenScore(1)).toBe("3");
      await user.click(scoreButtons(1)[5]);

      // The old behaviour left "5" on screen forever with only a toast.
      await waitFor(() => expect(chosenScore(1)).toBe("3"));
    });

    it("rolls back to unscored when there was no score before", async () => {
      const user = userEvent.setup();
      api.mockRejectedValue(new Error("offline"));
      renderConsole();

      expect(chosenScore(2)).toBeNull();
      await user.click(scoreButtons(2)[2]);
      await waitFor(() => expect(chosenScore(2)).toBeNull());
    });

    it("still tells the user the save failed", async () => {
      const user = userEvent.setup();
      api.mockRejectedValue(new Error("offline"));
      renderConsole();

      await user.click(scoreButtons(2)[2]);
      await waitFor(() => expect(toast.error).toHaveBeenCalled());
    });

    it("shows a round average consistent with the rolled-back scores", async () => {
      const user = userEvent.setup();
      api.mockRejectedValue(new Error("offline"));
      renderConsole();

      // Starts with 3 and 4 scored, so the average is 3.5.
      expect(screen.getByText("3.5")).toBeInTheDocument();

      await user.click(scoreButtons(2)[0]);
      // A rolled-back score must not linger in the average either.
      await waitFor(() => expect(screen.getByText("3.5")).toBeInTheDocument());
    });
  });

  describe("deleting an asked question", () => {
    /**
     * The bin icon. It has no accessible name today — that is ticket #21's
     * job — so this falls back to the only other button in the card.
     */
    const deleteButton = (id: number) => {
      const named = within(card(id)).queryAllByRole("button", {
        name: /remove|delete/i,
      });
      if (named.length > 0) return named[0];
      return within(card(id))
        .getAllByRole("button")
        .filter((b) => !/^Score [0-5]$/.test(b.getAttribute("aria-label") ?? ""))[0];
    };

    it("puts the question back when the delete fails", async () => {
      const user = userEvent.setup();
      api.mockRejectedValue(new Error("offline"));
      renderConsole();

      expect(screen.queryByTestId("asked-question-2")).toBeInTheDocument();
      await user.click(deleteButton(2));
      await waitFor(() =>
        expect(screen.getByTestId("asked-question-2")).toBeInTheDocument()
      );
    });

    it("puts it back in its original position, not at the end", async () => {
      const user = userEvent.setup();
      api.mockRejectedValue(new Error("offline"));
      renderConsole();

      await user.click(deleteButton(2));
      await waitFor(() =>
        expect(screen.getByTestId("asked-question-2")).toBeInTheDocument()
      );

      // Restoring a question to the end when it was second is still a bug.
      const ids = screen
        .getAllByTestId(/^asked-question-/)
        .map((el) => el.getAttribute("data-testid"));
      expect(ids).toEqual([
        "asked-question-1",
        "asked-question-2",
        "asked-question-3",
      ]);
    });
  });

  describe("a question the server reports as a duplicate", () => {
    it("tells the user instead of silently doing nothing", async () => {
      const user = userEvent.setup();
      // The Ask button is disabled for questions already in the round, so this
      // path is reached when the server knows something the page doesn't —
      // another tab added it, or the list is stale. The server is the
      // authority, and it answers `{ duplicate: true }` rather than failing.
      api.mockResolvedValue({ id: 99, duplicate: true });
      renderConsole();

      // Open the CSS category in the bank and ask the question inside it.
      const cssHeader = screen
        .getAllByText("CSS")
        .find((el) => el.className.includes("font-medium"))!;
      await user.click(cssHeader);
      await user.click(screen.getByRole("button", { name: /ask/i }));

      await waitFor(() => {
        const told =
          toast.info.mock.calls.length > 0 ||
          toast.warning.mock.calls.length > 0 ||
          toast.error.mock.calls.length > 0 ||
          toast.success.mock.calls.length > 0;
        // Used to `return` with no feedback at all, so the click looked broken.
        expect(told).toBe(true);
      });
    });

    it("does not add a second copy to the round", async () => {
      const user = userEvent.setup();
      api.mockResolvedValue({ id: 99, duplicate: true });
      renderConsole();

      const cssHeader = screen
        .getAllByText("CSS")
        .find((el) => el.className.includes("font-medium"))!;
      await user.click(cssHeader);
      await user.click(screen.getByRole("button", { name: /ask/i }));

      await waitFor(() => expect(api).toHaveBeenCalled());
      expect(screen.getAllByTestId(/^asked-question-/)).toHaveLength(3);
    });
  });

  describe("criterion ratings", () => {
    it("rolls a failed rating score back", async () => {
      const user = userEvent.setup();
      api.mockRejectedValue(new Error("offline"));
      renderConsole();

      // The scoring panel lives behind the right-hand rail.
      await user.click(screen.getByRole("button", { name: /scoring/i }));

      const row = () =>
        screen.getByText("Attitude").closest(".space-y-1\\.5") ??
        screen.getByText("Attitude").parentElement!.parentElement!;
      const buttons = () =>
        within(row() as HTMLElement).getAllByRole("button", {
          name: /^Score [0-5]$/,
        });

      await user.click(buttons()[1]);

      await waitFor(() => {
        // It started on 4 and must go back to 4.
        const pressed = buttons().find((b) => isSelected(b));
        expect(pressed?.textContent?.trim()).toBe("4");
      });
    });
  });
});
