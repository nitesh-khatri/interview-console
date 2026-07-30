import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../fixtures/render";
import { consoleProps } from "../fixtures/console";

/**
 * Ticket #23 — Confirm before destructive actions
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * Contract:
 *   - the confirmation carries data-testid="confirm-dialog"
 *   - its confirm button's accessible name matches the action (e.g. /delete/i)
 *
 * There are two layers here: a reusable ConfirmDialog, and its use in the
 * console for deleting a question and completing a round. The tests cover both.
 */

const api = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));

vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return { ...actual, api };
});
vi.mock("sonner", () => ({ toast, Toaster: () => null }));

let ConfirmDialog: typeof import("@/components/confirm-dialog").ConfirmDialog;
let InterviewConsole: typeof import("@/components/console/interview-console").InterviewConsole;

describe("ticket 23 — confirm destructive actions", () => {
  beforeAll(async () => {
    ({ ConfirmDialog } = await import("@/components/confirm-dialog"));
    ({ InterviewConsole } = await import(
      "@/components/console/interview-console"
    ));
  });

  beforeEach(() => {
    api.mockReset().mockResolvedValue({});
  });

  describe("ConfirmDialog", () => {
    it("shows title, description and a matching confirm button", () => {
      render(
        <ConfirmDialog
          open
          onOpenChange={vi.fn()}
          title="Delete this question?"
          description="Its score and notes go with it."
          confirmLabel="Delete question"
          onConfirm={vi.fn()}
        />
      );
      const dialog = screen.getByTestId("confirm-dialog");
      expect(dialog).toHaveTextContent("Delete this question?");
      expect(dialog).toHaveTextContent(/score and notes/i);
      expect(
        within(dialog).getByRole("button", { name: /delete/i })
      ).toBeInTheDocument();
    });

    it("runs onConfirm when confirmed", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      render(
        <ConfirmDialog
          open
          onOpenChange={vi.fn()}
          title="Delete?"
          description="x"
          confirmLabel="Delete"
          onConfirm={onConfirm}
        />
      );
      await user.click(screen.getByRole("button", { name: /delete/i }));
      expect(onConfirm).toHaveBeenCalledOnce();
    });

    it("does not run onConfirm when cancelled", async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      render(
        <ConfirmDialog
          open
          onOpenChange={vi.fn()}
          title="Delete?"
          description="x"
          confirmLabel="Delete"
          onConfirm={onConfirm}
        />
      );
      await user.click(screen.getByRole("button", { name: /cancel/i }));
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("cannot be double-clicked into two confirms", async () => {
      const user = userEvent.setup();
      let resolve!: () => void;
      const onConfirm = vi.fn(() => new Promise<void>((r) => (resolve = r)));
      render(
        <ConfirmDialog
          open
          onOpenChange={vi.fn()}
          title="Complete?"
          description="x"
          confirmLabel="Complete round"
          onConfirm={onConfirm}
        />
      );
      const btn = screen.getByRole("button", { name: /complete/i });
      await user.click(btn);
      await user.click(btn); // second click while the first is in flight
      resolve();
      expect(onConfirm).toHaveBeenCalledOnce();
    });
  });

  describe("in the console", () => {
    const renderConsole = (over: Record<string, unknown> = {}) =>
      renderWithProviders(<InterviewConsole {...(consoleProps(over) as never)} />);

    const deleteButton = () => {
      const card = screen.getByTestId("asked-question-1");
      const named = within(card).queryAllByRole("button", { name: /remove|delete/i });
      if (named.length) return named[0];
      return within(card)
        .getAllByRole("button")
        .filter((b) => !/^Score [0-5]$/.test(b.getAttribute("aria-label") ?? ""))[0];
    };

    it("does not delete a question until confirmed", async () => {
      const user = userEvent.setup();
      renderConsole();

      await user.click(deleteButton());
      // Still there — a dialog is up, nothing has been sent.
      expect(screen.getByTestId("asked-question-1")).toBeInTheDocument();
      expect(
        api.mock.calls.some((c) => (c[1] as { method?: string })?.method === "DELETE")
      ).toBe(false);

      const dialog = screen.getByTestId("confirm-dialog");
      await user.click(within(dialog).getByRole("button", { name: /delete/i }));

      await waitFor(() =>
        expect(screen.queryByTestId("asked-question-1")).not.toBeInTheDocument()
      );
    });

    it("confirms before completing a round", async () => {
      const user = userEvent.setup();
      renderConsole();

      await user.click(screen.getByRole("button", { name: /^complete$/i }));
      const dialog = await screen.findByTestId("confirm-dialog");
      expect(dialog).toHaveTextContent(/read-only/i);

      // Nothing patched to "completed" until confirmed.
      const completed = () =>
        api.mock.calls.some((c) =>
          String((c[1] as { body?: string })?.body ?? "").includes("completed")
        );
      expect(completed()).toBe(false);

      await user.click(within(dialog).getByRole("button", { name: /complete/i }));
      await waitFor(() => expect(completed()).toBe(true));
    });
  });
});
