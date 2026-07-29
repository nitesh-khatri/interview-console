import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsView } from "@/components/settings/settings-view";

// The component talks to the API through this helper, so we stub it rather
// than making real network calls.
vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return { ...actual, api: vi.fn().mockResolvedValue({ ok: true }) };
});

// Rendering the theme picker needs the provider from the app shell.
vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({ theme: "graphite", setTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/**
 * Ticket #5 (bug) — the Settings "Save" button never goes away
 *
 * Remove `.skip` below and make these pass.
 *
 * Reproduce it by hand first: Settings → Scoring parameters → add an item →
 * Save. The toast says it saved, but the Save button stays on screen forever,
 * so you can't tell whether your change actually persisted.
 */
describe("ticket 5 — settings save button", () => {
  const props = {
    role: "admin" as const,
    currentUserId: 1,
    ratingParams: ["Attitude", "Problem Solving"],
    roundPresets: ["Tech Round 1"],
    users: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides Save until something changes", () => {
    render(<SettingsView {...props} />);
    expect(screen.queryByRole("button", { name: /^save$/i })).not.toBeInTheDocument();
  });

  it("shows Save once an item is added", async () => {
    const user = userEvent.setup();
    render(<SettingsView {...props} />);

    await user.type(screen.getByPlaceholderText(/culture fit/i), "Ownership");
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("button", { name: /^save$/i })).toBeInTheDocument();
  });

  it("hides Save again after a successful save", async () => {
    const user = userEvent.setup();
    render(<SettingsView {...props} />);

    await user.type(screen.getByPlaceholderText(/culture fit/i), "Ownership");
    await user.keyboard("{Enter}");

    const saveButton = await screen.findByRole("button", { name: /^save$/i });
    await user.click(saveButton);

    // This is the bug: the button used to stay visible forever.
    await vi.waitFor(() => {
      expect(screen.queryByRole("button", { name: /^save$/i })).not.toBeInTheDocument();
    });
  });

  it("shows Save again if you change something else afterwards", async () => {
    const user = userEvent.setup();
    render(<SettingsView {...props} />);
    const input = screen.getByPlaceholderText(/culture fit/i);

    await user.type(input, "Ownership");
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("button", { name: /^save$/i }));
    await vi.waitFor(() => {
      expect(screen.queryByRole("button", { name: /^save$/i })).not.toBeInTheDocument();
    });

    await user.type(input, "Collaboration");
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("button", { name: /^save$/i })).toBeInTheDocument();
  });
});
