import { describe, it, expect, beforeAll } from "vitest";
import { screen } from "@testing-library/react";
import { manyCandidates } from "../fixtures/candidates";
import { renderWithProviders as render } from "../fixtures/render";

/**
 * Ticket #6 — Migrate both tables to the shadcn Table primitive
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * The `Table` primitive marks every part it renders with a `data-slot`
 * attribute (`table`, `table-header`, `table-row`, and so on). These tests look
 * for those, so they pass only if the markup really goes through the primitive
 * rather than a hand-written <table> that happens to look the same.
 */
let CandidatesView: typeof import("@/components/candidates/candidates-view").CandidatesView;

describe("ticket 6 — table primitive", () => {
  beforeAll(async () => {
    ({ CandidatesView } = await import("@/components/candidates/candidates-view"));
  });

  const renderView = () =>
    render(<CandidatesView candidates={manyCandidates()} currentUserId={10} />);

  it("renders the table through the shadcn primitive", () => {
    const { container } = renderView();
    expect(container.querySelector('[data-slot="table"]')).toBeInTheDocument();
  });

  it("uses the primitive's header, body and rows", () => {
    const { container } = renderView();
    expect(container.querySelector('[data-slot="table-header"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="table-body"]')).toBeInTheDocument();
    expect(
      container.querySelectorAll('[data-slot="table-row"]').length
    ).toBeGreaterThan(1);
  });

  it("uses TableHead for headers and TableCell for cells", () => {
    const { container } = renderView();
    expect(
      container.querySelectorAll('[data-slot="table-head"]').length
    ).toBeGreaterThan(2);
    expect(
      container.querySelectorAll('[data-slot="table-cell"]').length
    ).toBeGreaterThan(2);
  });

  it("puts the table in a horizontally scrollable container", () => {
    const { container } = renderView();
    const scroller = container.querySelector('[data-slot="table-container"]');
    expect(scroller).toBeInTheDocument();
    expect(scroller!.className).toMatch(/overflow-x-auto/);
  });

  it("does not clip the scroll container with overflow-hidden", () => {
    const { container } = renderView();
    const scroller = container.querySelector('[data-slot="table-container"]');
    // An ancestor with overflow-hidden makes the right-hand columns
    // unreachable on a narrow screen — that's the bug this ticket fixes.
    let el = scroller!.parentElement;
    while (el && el !== container) {
      expect(el.className).not.toMatch(/\boverflow-hidden\b/);
      el = el.parentElement;
    }
  });

  it("still renders candidate names", () => {
    renderView();
    expect(screen.getByText("Priya Raman")).toBeInTheDocument();
  });

  it("still renders the per-row select checkboxes", () => {
    renderView();
    expect(
      screen.getByRole("checkbox", { name: /select priya raman/i })
    ).toBeInTheDocument();
  });
});
