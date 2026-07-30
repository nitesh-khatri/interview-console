import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders as render } from "../fixtures/render";
import { consoleProps } from "../fixtures/console";

/**
 * Ticket #20 — The question bank is unreachable on mobile
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * Contract:
 *   - data-testid="mobile-bank-trigger" on the button that opens the bank
 *   - data-testid="mobile-bank-sheet" on the sheet content
 *
 * jsdom has no viewport, so these can't assert the `md:hidden` breakpoint
 * directly — that's for you to verify by eye at 375px. They do assert the
 * behaviour: the trigger exists, opens a sheet, adding a question works and
 * closes it, and it doesn't fight the scoring panel.
 */

const api = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 999 }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));

vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return { ...actual, api };
});
vi.mock("sonner", () => ({ toast, Toaster: () => null }));

let InterviewConsole: typeof import("@/components/console/interview-console").InterviewConsole;

describe("ticket 20 — mobile question bank", () => {
  beforeAll(async () => {
    ({ InterviewConsole } = await import(
      "@/components/console/interview-console"
    ));
  });

  beforeEach(() => api.mockReset().mockResolvedValue({ id: 999 }));

  const renderConsole = (over: Record<string, unknown> = {}) =>
    render(<InterviewConsole {...(consoleProps(over) as never)} />);

  it("offers a trigger to open the question bank", () => {
    renderConsole();
    expect(screen.getByTestId("mobile-bank-trigger")).toBeInTheDocument();
  });

  it("opens the bank in a sheet", async () => {
    const user = userEvent.setup();
    renderConsole();
    expect(screen.queryByTestId("mobile-bank-sheet")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("mobile-bank-trigger"));
    await waitFor(() =>
      expect(screen.getByTestId("mobile-bank-sheet")).toBeInTheDocument()
    );
  });

  it("can add a question from inside the sheet, then closes", async () => {
    const user = userEvent.setup();
    renderConsole();
    await user.click(screen.getByTestId("mobile-bank-trigger"));
    const sheet = await screen.findByTestId("mobile-bank-sheet");

    // Open a category and ask a question.
    const cssHeader = within(sheet)
      .getAllByText("CSS")
      .find((el) => el.className.includes("font-medium"))!;
    await user.click(cssHeader);
    await user.click(within(sheet).getByRole("button", { name: /ask/i }));

    await waitFor(() => expect(api).toHaveBeenCalled());
    // Sheet closes so you can see the question land in the list.
    await waitFor(() =>
      expect(screen.queryByTestId("mobile-bank-sheet")).not.toBeInTheDocument()
    );
  });

  it("does not offer the trigger in a read-only round", () => {
    renderConsole({ readOnly: true });
    expect(screen.queryByTestId("mobile-bank-trigger")).not.toBeInTheDocument();
  });

  it("shows only one sheet at a time", async () => {
    const user = userEvent.setup();
    renderConsole();
    await user.click(screen.getByTestId("mobile-bank-trigger"));
    await screen.findByTestId("mobile-bank-sheet");

    // The bank sheet is modal, so the scoring/candidate panel must not also be
    // open behind it — exactly one sheet on screen.
    expect(screen.queryByText("Candidate info")).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="sheet-content"]')).toHaveLength(1);
  });
});
