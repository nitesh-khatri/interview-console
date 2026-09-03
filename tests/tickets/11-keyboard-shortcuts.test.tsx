import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders as render } from "../fixtures/render";
import { consoleProps } from "../fixtures/console";

/**
 * Ticket #11 — Keyboard shortcuts for scoring
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * Contract:
 *   - each question card carries data-testid="asked-question-<id>"
 *   - the focused card carries data-active="true"
 *   - the help dialog carries data-testid="shortcuts-dialog"
 *
 * `api()` is mocked so scoring doesn't hit a real endpoint.
 */

const api = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return { ...actual, api };
});
vi.mock("sonner", () => ({ toast, Toaster: () => null }));

let InterviewConsole: typeof import("@/components/console/interview-console").InterviewConsole;

describe("ticket 11 — keyboard shortcuts", () => {
  beforeAll(async () => {
    ({ InterviewConsole } = await import(
      "@/components/console/interview-console"
    ));
  });

  beforeEach(() => {
    api.mockReset().mockResolvedValue({});
  });

  const renderConsole = (over: Record<string, unknown> = {}) =>
    render(<InterviewConsole {...(consoleProps(over) as never)} />);

  /** The id of the currently focused (data-active) card, or null. */
  const activeId = () => {
    const el = document.querySelector('[data-active="true"]');
    return el?.getAttribute("data-testid")?.replace("asked-question-", "") ?? null;
  };

  const chosenScore = (id: number) => {
    const card = screen.getByTestId(`asked-question-${id}`);
    const pressed = within(card)
      .getAllByRole("button", { name: /^Score [0-5]$/ })
      .find((b) => b.getAttribute("aria-pressed") === "true");
    return pressed?.textContent?.trim() ?? null;
  };

  it("focuses the first question to begin with", () => {
    renderConsole();
    expect(activeId()).toBe("1");
  });

  it("moves focus down with j and up with k", () => {
    renderConsole();
    fireEvent.keyDown(document.body, { key: "j" });
    expect(activeId()).toBe("2");
    fireEvent.keyDown(document.body, { key: "j" });
    expect(activeId()).toBe("3");
    fireEvent.keyDown(document.body, { key: "k" });
    expect(activeId()).toBe("2");
  });

  it("does not move past the last question or before the first", () => {
    renderConsole();
    fireEvent.keyDown(document.body, { key: "k" }); // already at first
    expect(activeId()).toBe("1");
    fireEvent.keyDown(document.body, { key: "j" });
    fireEvent.keyDown(document.body, { key: "j" });
    fireEvent.keyDown(document.body, { key: "j" }); // past the end
    expect(activeId()).toBe("3");
  });

  it("scores the focused question with the number keys", async () => {
    renderConsole();
    // Focus the second question (starts unscored) and press 5.
    fireEvent.keyDown(document.body, { key: "j" });
    fireEvent.keyDown(document.body, { key: "5" });
    await waitFor(() => expect(chosenScore(2)).toBe("5"));
    expect(api).toHaveBeenCalled();
  });

  it("clears the focused question's score with 0", async () => {
    renderConsole();
    // First question starts on 3.
    expect(chosenScore(1)).toBe("3");
    fireEvent.keyDown(document.body, { key: "0" });
    await waitFor(() => expect(chosenScore(1)).toBeNull());
  });

  it("does not score while the user is typing in a notes field", async () => {
    const user = userEvent.setup();
    renderConsole();
    const notes = screen.getAllByPlaceholderText(/notes on the answer/i)[0];
    await user.click(notes);
    await user.type(notes, "just 3 things");

    // The "3" was typed into the note, not turned into a score.
    expect(notes).toHaveValue("just 3 things");
    expect(chosenScore(1)).toBe("3"); // unchanged from its starting value
    // And crucially api was never called to persist a score change.
    expect(
      api.mock.calls.filter((c) => String(c[0]).includes("/questions/")).length
    ).toBe(0);
  });

  it("opens the shortcuts help with ? and closes it with Escape", async () => {
    renderConsole();
    expect(screen.queryByTestId("shortcuts-dialog")).not.toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: "?" });
    await waitFor(() =>
      expect(screen.getByTestId("shortcuts-dialog")).toBeInTheDocument()
    );

    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByTestId("shortcuts-dialog")).not.toBeInTheDocument()
    );
  });

  it("does not act on shortcuts in a read-only (completed) round", () => {
    renderConsole({ readOnly: true, round: { ...consoleProps().round, status: "completed" } });
    fireEvent.keyDown(document.body, { key: "j" });
    // Nothing is focusable to score in a read-only round.
    expect(activeId()).toBeNull();
    fireEvent.keyDown(document.body, { key: "?" });
    expect(screen.queryByTestId("shortcuts-dialog")).not.toBeInTheDocument();
  });
});
