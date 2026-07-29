import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { Users } from "lucide-react";

/**
 * Ticket #4 — Extract EmptyState and ListEditor into shared components
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * You need to create `src/components/empty-state.tsx` exporting `EmptyState`,
 * which renders an element with data-testid="empty-state".
 *
 * The props are up to you, but these tests assume: icon, title, description,
 * action.
 */
let EmptyState: typeof import("@/components/empty-state").EmptyState;

describe("ticket 4 — shared components", () => {
  beforeAll(async () => {
    ({ EmptyState } = await import("@/components/empty-state"));
  });

  it("renders the title", () => {
    render(<EmptyState title="No candidates yet" />);
    expect(screen.getByTestId("empty-state")).toHaveTextContent("No candidates yet");
  });

  it("renders the description when given one", () => {
    render(
      <EmptyState title="No candidates yet" description="Add your first candidate." />
    );
    expect(screen.getByText("Add your first candidate.")).toBeInTheDocument();
  });

  it("renders an action when given one", () => {
    render(
      <EmptyState title="No candidates yet" action={<button>Add candidate</button>} />
    );
    expect(screen.getByRole("button", { name: "Add candidate" })).toBeInTheDocument();
  });

  it("works without a description or action", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("renders an icon when given one", () => {
    const { container } = render(<EmptyState icon={Users} title="No candidates yet" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("uses theme tokens, not hardcoded colours", () => {
    render(<EmptyState title="No candidates yet" />);
    const el = screen.getByTestId("empty-state");
    expect(el.className).not.toMatch(/#[0-9a-f]{3,6}/i);
    expect(el.className).not.toMatch(/\bbg-(gray|slate|zinc)-\d{3}\b/);
  });
});
