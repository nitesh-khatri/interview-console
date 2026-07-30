import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Ticket #22 — Command palette (⌘K)
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * Contract:
 *   - data-testid="command-palette" on the dialog
 *   - data-testid="command-input" on the search field
 *   - data-testid="command-item-<key>" on each result, data-active on the
 *     highlighted one
 *
 * next/navigation is mocked globally in tests/setup.ts. The theme provider is
 * mocked here so selecting a theme is observable.
 */

const setTheme = vi.hoisted(() => vi.fn());
vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({ theme: "graphite", setTheme }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

let CommandPalette: typeof import("@/components/command-palette").CommandPalette;

const CANDIDATES = [
  { id: 1, name: "Nadia Fernandes" },
  { id: 2, name: "Alex Chen" },
  { id: 3, name: "Priya Raman" },
];

describe("ticket 22 — command palette", () => {
  beforeAll(async () => {
    ({ CommandPalette } = await import("@/components/command-palette"));
  });

  beforeEach(() => {
    push.mockReset();
    setTheme.mockReset();
  });

  const renderPalette = () =>
    render(<CommandPalette candidates={CANDIDATES} canEditBank />);

  const openWithKey = () =>
    fireEvent.keyDown(document.body, { key: "k", metaKey: true });

  it("opens on ⌘K", async () => {
    renderPalette();
    expect(screen.queryByTestId("command-palette")).not.toBeInTheDocument();
    openWithKey();
    await waitFor(() =>
      expect(screen.getByTestId("command-palette")).toBeInTheDocument()
    );
  });

  it("opens on Ctrl+K too", async () => {
    renderPalette();
    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
    await waitFor(() =>
      expect(screen.getByTestId("command-palette")).toBeInTheDocument()
    );
  });

  it("does not open while typing in an input", () => {
    render(
      <>
        <input data-testid="somewhere" />
        <CommandPalette candidates={CANDIDATES} canEditBank />
      </>
    );
    const input = screen.getByTestId("somewhere");
    input.focus();
    fireEvent.keyDown(input, { key: "k", metaKey: true });
    expect(screen.queryByTestId("command-palette")).not.toBeInTheDocument();
  });

  it("filters candidates by name", async () => {
    const user = userEvent.setup();
    renderPalette();
    openWithKey();
    await screen.findByTestId("command-input");
    await user.type(screen.getByTestId("command-input"), "priya");

    expect(screen.getByTestId("command-item-candidate-3")).toBeInTheDocument();
    expect(
      screen.queryByTestId("command-item-candidate-1")
    ).not.toBeInTheDocument();
  });

  it("offers navigation and theme commands", async () => {
    renderPalette();
    openWithKey();
    await screen.findByTestId("command-palette");
    expect(screen.getByTestId("command-item-nav-settings")).toBeInTheDocument();
    expect(screen.getByTestId("command-item-theme-midnight")).toBeInTheDocument();
  });

  it("navigates to a candidate on Enter", async () => {
    const user = userEvent.setup();
    renderPalette();
    openWithKey();
    await screen.findByTestId("command-input");
    await user.type(screen.getByTestId("command-input"), "alex");
    fireEvent.keyDown(screen.getByTestId("command-input"), { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/candidates/2");
  });

  it("applies a theme when its command is chosen", async () => {
    const user = userEvent.setup();
    renderPalette();
    openWithKey();
    await screen.findByTestId("command-palette");
    await user.click(screen.getByTestId("command-item-theme-forest"));
    expect(setTheme).toHaveBeenCalledWith("forest");
  });

  it("moves the highlight with the arrow keys and wraps", async () => {
    renderPalette();
    openWithKey();
    const input = await screen.findByTestId("command-input");

    // First item is active initially.
    const items = () => screen.getAllByRole("option");
    expect(items()[0]).toHaveAttribute("data-active", "true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(items()[1]).toHaveAttribute("data-active", "true");
    expect(items()[0]).not.toHaveAttribute("data-active");

    // Wrap from the top backwards to the last item.
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    const all = items();
    expect(all[all.length - 1]).toHaveAttribute("data-active", "true");
  });

  it("shows a message and does nothing on Enter with no results", async () => {
    const user = userEvent.setup();
    renderPalette();
    openWithKey();
    await screen.findByTestId("command-input");
    await user.type(screen.getByTestId("command-input"), "zzzznothing");
    expect(screen.getByText(/no results/i)).toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId("command-input"), { key: "Enter" });
    expect(push).not.toHaveBeenCalled();
  });

  it("starts from an empty query each time it opens", async () => {
    const user = userEvent.setup();
    renderPalette();
    openWithKey();
    await screen.findByTestId("command-input");
    await user.type(screen.getByTestId("command-input"), "alex");
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByTestId("command-palette")).not.toBeInTheDocument()
    );

    openWithKey();
    const input = await screen.findByTestId("command-input");
    expect(input).toHaveValue("");
  });
});
