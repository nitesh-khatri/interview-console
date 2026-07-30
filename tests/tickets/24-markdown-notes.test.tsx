import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Ticket #24 — Markdown support in interview notes
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * Contract:
 *   - a <Markdown source={...} /> renderer, exported from src/components/markdown.tsx,
 *     that renders data-testid="notes-preview"
 *   - the scoring panel's overall notes get a Write/Preview toggle
 *     (data-testid="notes-preview-toggle")
 *
 * The escaping test is the one that matters most — do it first.
 */

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast, Toaster: () => null }));

let Markdown: typeof import("@/components/markdown").Markdown;
let ScoringPanel: typeof import("@/components/console/scoring-panel").ScoringPanel;

describe("ticket 24 — markdown notes", () => {
  beforeAll(async () => {
    ({ Markdown } = await import("@/components/markdown"));
    ({ ScoringPanel } = await import("@/components/console/scoring-panel"));
  });

  describe("Markdown rendering", () => {
    it("renders bold, italic and inline code", () => {
      render(<Markdown source="This is **bold**, *italic* and `code`." />);
      const el = screen.getByTestId("notes-preview");
      expect(within(el).getByText("bold").tagName).toBe("STRONG");
      expect(within(el).getByText("italic").tagName).toBe("EM");
      expect(within(el).getByText("code").tagName).toBe("CODE");
    });

    it("renders an unordered list", () => {
      render(<Markdown source={"- one\n- two\n- three"} />);
      expect(screen.getAllByRole("listitem")).toHaveLength(3);
    });

    it("renders a fenced code block", () => {
      const { container } = render(
        <Markdown source={"```\nconst x = 1;\n```"} />
      );
      const pre = container.querySelector("pre");
      expect(pre).toBeInTheDocument();
      expect(pre).toHaveTextContent("const x = 1;");
    });

    it("renders a safe link", () => {
      render(<Markdown source="see [the docs](https://example.com)" />);
      const link = screen.getByRole("link", { name: "the docs" });
      expect(link).toHaveAttribute("href", "https://example.com");
    });

    it("neutralises a javascript: link but keeps the text", () => {
      render(<Markdown source="[click me](javascript:alert(1))" />);
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.getByText(/click me/)).toBeInTheDocument();
    });

    it("renders script tags as text and executes nothing", () => {
      const { container } = render(
        <Markdown source={"<script>alert(1)</script> and **bold**"} />
      );
      // The single most important property: no live <script> in the DOM.
      expect(container.querySelector("script")).toBeNull();
      expect(screen.getByTestId("notes-preview")).toHaveTextContent(
        "<script>alert(1)</script>"
      );
      // And normal markdown around it still works.
      expect(screen.getByText("bold").tagName).toBe("STRONG");
    });

    it("renders unclosed markdown as plain text rather than swallowing it", () => {
      render(<Markdown source="**not bold and more text after" />);
      expect(screen.queryByText("not bold", { exact: false })).toBeInTheDocument();
      // No stray <strong> from the unmatched marker.
      expect(
        screen.getByTestId("notes-preview").querySelector("strong")
      ).toBeNull();
    });

    it("preserves line breaks in plain notes", () => {
      const { container } = render(<Markdown source={"line one\nline two"} />);
      expect(container.querySelectorAll("br").length).toBeGreaterThanOrEqual(1);
    });

    it("uses theme tokens, not hardcoded colours", () => {
      const { container } = render(<Markdown source="`code`" />);
      expect(container.innerHTML).not.toMatch(/#[0-9a-f]{6}/i);
    });
  });

  describe("the Write/Preview toggle in the scoring panel", () => {
    const props = {
      ratings: [],
      onSetScore: vi.fn(),
      onSetNote: vi.fn(),
      onAddParam: vi.fn(),
      onRemoveParam: vi.fn(),
      recommendation: null,
      onSetRecommendation: vi.fn(),
      overallNotes: "This is **important**.",
      onNotesChange: vi.fn(),
      readOnly: false,
    };

    it("swaps the textarea for a rendered preview", async () => {
      const user = userEvent.setup();
      // ScoringPanel takes several callbacks; extras are ignored.
      render(<ScoringPanel {...(props as never)} />);

      // Editing by default: a textarea is shown.
      expect(
        screen.getByPlaceholderText(/summary|markdown/i)
      ).toBeInTheDocument();

      await user.click(screen.getByTestId("notes-preview-toggle"));

      // Preview shows rendered markdown, no textarea.
      const preview = screen.getByTestId("notes-preview");
      expect(within(preview).getByText("important").tagName).toBe("STRONG");
    });
  });
});
