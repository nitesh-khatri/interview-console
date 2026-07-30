import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Ticket #21 — Accessibility pass
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * Four gaps: nameless icon buttons, the 0–5 score selector, segmented controls,
 * and the keyboard-unreachable file input. These tests cover the score selector
 * as a radiogroup (the meatiest part) and the file input; the icon-button names
 * are checked in the question bank. Verify focus rings and VoiceOver by hand —
 * a test can't hear a screen reader.
 */
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast, Toaster: () => null }));

let ScoreButtons: typeof import("@/components/console/score-buttons").ScoreButtons;

describe("ticket 21 — accessibility", () => {
  beforeAll(async () => {
    ({ ScoreButtons } = await import("@/components/console/score-buttons"));
  });

  describe("the score selector as a radiogroup", () => {
    it("is a radiogroup of six options", () => {
      render(<ScoreButtons value={null} onChange={vi.fn()} />);
      expect(screen.getByRole("radiogroup")).toBeInTheDocument();
      expect(screen.getAllByRole("radio")).toHaveLength(6);
    });

    it("exposes the selected option with aria-checked", () => {
      render(<ScoreButtons value={3} onChange={vi.fn()} />);
      const three = screen.getByRole("radio", { name: "Score 3" });
      expect(three).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: "Score 2" })).toHaveAttribute(
        "aria-checked",
        "false"
      );
    });

    it("is a single tab stop (roving tabindex)", () => {
      render(<ScoreButtons value={3} onChange={vi.fn()} />);
      const tabbable = screen
        .getAllByRole("radio")
        .filter((r) => r.getAttribute("tabindex") === "0");
      expect(tabbable).toHaveLength(1);
      // The selected option is the one in the tab order.
      expect(tabbable[0]).toHaveAccessibleName("Score 3");
    });

    it("moves selection focus with the arrow keys", async () => {
      const user = userEvent.setup();
      render(<ScoreButtons value={2} onChange={vi.fn()} />);
      const two = screen.getByRole("radio", { name: "Score 2" });
      two.focus();
      await user.keyboard("{ArrowRight}");
      expect(screen.getByRole("radio", { name: "Score 3" })).toHaveFocus();
      await user.keyboard("{ArrowLeft}{ArrowLeft}");
      expect(screen.getByRole("radio", { name: "Score 1" })).toHaveFocus();
    });

    it("selects a score on click and clears it when clicked again", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { rerender } = render(
        <ScoreButtons value={null} onChange={onChange} />
      );
      await user.click(screen.getByRole("radio", { name: "Score 4" }));
      expect(onChange).toHaveBeenLastCalledWith(4);

      rerender(<ScoreButtons value={4} onChange={onChange} />);
      await user.click(screen.getByRole("radio", { name: "Score 4" }));
      expect(onChange).toHaveBeenLastCalledWith(null);
    });

    it("uses theme tokens, not hardcoded colours", () => {
      const { container } = render(<ScoreButtons value={5} onChange={vi.fn()} />);
      expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i);
      expect(container.innerHTML).not.toMatch(/\bbg-(green|red|yellow)-\d{3}\b/);
    });
  });

  describe("the resume file input", () => {
    it("stays in the tab order (not display:none)", async () => {
      const { AddCandidateDialog } = await import(
        "@/components/candidates/add-candidate-dialog"
      );
      const user = userEvent.setup();
      render(<AddCandidateDialog trigger={<button>Add</button>} />);
      await user.click(screen.getByRole("button", { name: "Add" }));

      const fileInput = document.querySelector('input[type="file"]') as HTMLElement;
      expect(fileInput).toBeInTheDocument();
      // display:none would remove it from the accessibility tree and tab order;
      // sr-only keeps it reachable. It must have an accessible name, too.
      expect(fileInput).toHaveAccessibleName();
      expect(fileInput.className).not.toMatch(/\bhidden\b/);
    });
  });
});
