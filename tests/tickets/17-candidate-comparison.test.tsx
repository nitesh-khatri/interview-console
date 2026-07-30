import { describe, it, expect, beforeAll } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "../fixtures/render";
import type { ComparisonCandidate } from "@/lib/pipeline";

/**
 * Ticket #17 — Candidate comparison view
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * Contract:
 *   - data-testid="comparison-view"
 *   - data-testid="comparison-column-<id>" per candidate
 *   - (the compare-button lives in the candidates selection bar — covered by
 *     ticket #9's suite once you wire it up)
 *
 * The view is a pure presentational component taking already-loaded data, so it
 * tests without a database. The interesting bit is the union of criteria across
 * candidates who don't share the same ones.
 */
let ComparisonView: typeof import("@/components/candidates/comparison-view").ComparisonView;

const make = (over: Partial<ComparisonCandidate>): ComparisonCandidate => ({
  id: 1,
  name: "Nadia Fernandes",
  applied_role: "Frontend Engineer",
  current_company: "Harbour Studio",
  status: "in_process",
  score: 3.5,
  recommendation: "yes",
  ratings: {},
  ...over,
});

describe("ticket 17 — candidate comparison", () => {
  beforeAll(async () => {
    ({ ComparisonView } = await import(
      "@/components/candidates/comparison-view"
    ));
  });

  const renderView = (candidates: ComparisonCandidate[]) =>
    renderWithProviders(<ComparisonView candidates={candidates} />);

  it("renders a column per candidate", () => {
    renderView([
      make({ id: 1, name: "Nadia Fernandes" }),
      make({ id: 2, name: "Alex Chen" }),
    ]);
    expect(screen.getByTestId("comparison-view")).toBeInTheDocument();
    expect(screen.getByTestId("comparison-column-1")).toHaveTextContent(
      "Nadia Fernandes"
    );
    expect(screen.getByTestId("comparison-column-2")).toHaveTextContent(
      "Alex Chen"
    );
  });

  it("takes the union of criteria across candidates", () => {
    renderView([
      make({ id: 1, ratings: { Attitude: 4, Communication: 3 } }),
      make({ id: 2, ratings: { Attitude: 5, "Problem Solving": 2 } }),
    ]);
    const view = screen.getByTestId("comparison-view");
    // Every criterion any candidate has appears as a row.
    expect(within(view).getByText("Attitude")).toBeInTheDocument();
    expect(within(view).getByText("Communication")).toBeInTheDocument();
    expect(within(view).getByText("Problem Solving")).toBeInTheDocument();
  });

  it("shows a blank, not a zero, for a criterion a candidate lacks", () => {
    renderView([
      make({ id: 1, ratings: { Attitude: 4 } }),
      make({ id: 2, ratings: {} }),
    ]);
    const col2 = screen.getByTestId("comparison-column-2");
    // The header cell exists; candidate 2 has no Attitude score, so no "0".
    expect(col2).not.toHaveTextContent("0");
  });

  it("marks the best value in a row accessibly, not by colour alone", () => {
    renderView([
      make({ id: 1, score: 4.5 }),
      make({ id: 2, score: 2.0 }),
    ]);
    // Some element carries an accessible 'best in row' marker.
    expect(screen.getAllByLabelText(/best in row/i).length).toBeGreaterThan(0);
  });

  it("handles a candidate with no completed rounds without breaking", () => {
    renderView([
      make({ id: 1, score: null, recommendation: null, ratings: {} }),
      make({ id: 2, score: 3 }),
    ]);
    expect(screen.getByTestId("comparison-view")).toBeInTheDocument();
    expect(screen.getByTestId("comparison-column-1")).toBeInTheDocument();
  });

  it("supports three candidates", () => {
    renderView([
      make({ id: 1 }),
      make({ id: 2 }),
      make({ id: 3, name: "Béatrice Morel" }),
    ]);
    expect(screen.getByTestId("comparison-column-3")).toHaveTextContent(
      "Béatrice Morel"
    );
  });
});
