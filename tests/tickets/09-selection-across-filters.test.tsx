import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { manyCandidates } from "../fixtures/candidates";
import { renderWithProviders as render } from "../fixtures/render";
import { resetUrl } from "../fixtures/next-navigation";

vi.mock("next/navigation", async () => {
  const { navigation } = await import("../fixtures/next-navigation");
  return navigation;
});

/**
 * Ticket #9 — Selection count disagrees with what gets shared
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * Several of these fail on today's code and pass once it's fixed. If they all
 * pass before you've changed anything, you've un-skipped the wrong file.
 *
 * Your markup needs:
 *   data-testid="selection-count"  — the element containing the count
 *   data-testid="select-all"       — the header checkbox
 *
 * The share dialog is mocked below so these tests can see exactly which
 * candidate ids it was handed. That is the whole point of the bug: the number
 * on screen and the ids passed to sharing came from two different places.
 */

/** Records the candidateIds the share dialog is rendered with. */
const shared: number[][] = [];

vi.mock("@/components/candidates/share-batch-dialog", () => ({
  ShareBatchDialog: ({ candidateIds }: { candidateIds: number[] }) => {
    shared.push(candidateIds);
    return (
      <div data-testid="share-dialog" data-ids={candidateIds.join(",")} />
    );
  },
}));

let CandidatesView: typeof import("@/components/candidates/candidates-view").CandidatesView;

describe("ticket 9 — selection across filters", () => {
  beforeAll(async () => {
    ({ CandidatesView } = await import("@/components/candidates/candidates-view"));
  });

  beforeEach(() => {
    resetUrl();
    shared.length = 0;
  });

  const renderView = () =>
    render(<CandidatesView candidates={manyCandidates()} currentUserId={10} />);

  /** The ids the share dialog most recently received. */
  const sharedIds = () =>
    (screen.getByTestId("share-dialog").getAttribute("data-ids") ?? "")
      .split(",")
      .filter(Boolean)
      .map(Number);

  const count = () => screen.getByTestId("selection-count").textContent ?? "";

  const rowCheckboxes = () => {
    const body = document.querySelector('[data-slot="table-body"]')!;
    return within(body as HTMLElement).getAllByRole("checkbox");
  };

  it("counts what the user ticked", async () => {
    const user = userEvent.setup();
    renderView();
    const boxes = rowCheckboxes();
    await user.click(boxes[0]);
    await user.click(boxes[1]);
    expect(count()).toContain("2");
  });

  it("the count matches the ids handed to sharing", async () => {
    const user = userEvent.setup();
    renderView();
    const boxes = rowCheckboxes();
    await user.click(boxes[0]);
    await user.click(boxes[1]);
    await user.click(boxes[2]);

    expect(count()).toContain("3");
    expect(sharedIds()).toHaveLength(3);
  });

  it("count and shared ids still agree after the filter changes", async () => {
    const user = userEvent.setup();
    renderView();

    // Select everything visible on the unfiltered first page.
    await user.click(screen.getByTestId("select-all"));
    // Then narrow to a filter that hides most of them.
    await user.click(screen.getByRole("button", { name: "Assigned to me" }));

    // This is the bug: the bar used to keep saying "10 selected" while sharing
    // received only the handful still visible.
    const shown = Number((count().match(/\d+/) ?? ["0"])[0]);
    expect(sharedIds()).toHaveLength(shown);
  });

  it("count and shared ids still agree after a search narrows the list", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByTestId("select-all"));

    await user.type(screen.getByTestId("search-input"), "priya");
    await waitFor(() => {
      const body = document.querySelector('[data-slot="table-body"]')!;
      expect(within(body as HTMLElement).getAllByRole("row")).toHaveLength(1);
    });

    const shown = Number((count().match(/\d+/) ?? ["0"])[0]);
    expect(sharedIds()).toHaveLength(shown);
  });

  describe("the header checkbox", () => {
    it("is unchecked when nothing is selected", () => {
      renderView();
      expect(screen.getByTestId("select-all")).not.toBeChecked();
    });

    it("reports a mixed state when only some rows are selected", async () => {
      const user = userEvent.setup();
      renderView();
      await user.click(rowCheckboxes()[0]);

      const selectAll = screen.getByTestId("select-all");
      expect(selectAll).toHaveAttribute("aria-checked", "mixed");
      expect((selectAll as HTMLInputElement).indeterminate).toBe(true);
    });

    it("selects everything in the current view when clicked from empty", async () => {
      const user = userEvent.setup();
      renderView();
      await user.click(screen.getByTestId("select-all"));
      expect(sharedIds().length).toBeGreaterThan(1);
    });

    it("clears the view's rows when clicked while mixed", async () => {
      const user = userEvent.setup();
      renderView();
      await user.click(rowCheckboxes()[0]);
      expect(screen.getByTestId("select-all")).toHaveAttribute(
        "aria-checked",
        "mixed"
      );

      // Clicking an indeterminate box should clear, not select everything.
      await user.click(screen.getByTestId("select-all"));
      expect(screen.queryByTestId("selection-count")).not.toBeInTheDocument();
    });

    it("clears the view's rows when clicked while fully checked", async () => {
      const user = userEvent.setup();
      renderView();
      await user.click(screen.getByTestId("select-all"));
      await user.click(screen.getByTestId("select-all"));
      expect(screen.queryByTestId("selection-count")).not.toBeInTheDocument();
    });
  });

  it("tells the user when the filter is hiding selected candidates", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByTestId("select-all"));
    await user.click(screen.getByRole("button", { name: "Assigned to me" }));

    // Whatever the chosen behaviour, the user must be able to tell that some of
    // their selection is not included. Silently acting on a different set is
    // what makes the original bug dangerous.
    const bar = screen.getByTestId("selection-count").closest("div")!;
    expect(bar.textContent).toMatch(/hidden|not included|filter/i);
  });

  it("clearing the selection hides the bar", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(rowCheckboxes()[0]);
    await user.click(screen.getByRole("button", { name: /clear selection/i }));
    expect(screen.queryByTestId("selection-count")).not.toBeInTheDocument();
  });
});
