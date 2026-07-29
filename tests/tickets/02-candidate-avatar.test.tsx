import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CandidateAvatar, initialsOf, colorIndexOf } from "@/components/candidate-avatar";

/**
 * Ticket #2 — Candidate avatar with deterministic colour
 *
 * Remove `.skip` below and make these pass.
 *
 * Your component must:
 *   - live at src/components/candidate-avatar.tsx
 *   - export `CandidateAvatar`, `initialsOf` and `colorIndexOf`
 *   - render an element with data-testid="candidate-avatar"
 */
describe("ticket 2 — candidate avatar", () => {
  describe("initialsOf", () => {
    it("takes the first and last initial of a full name", () => {
      expect(initialsOf("Nadia Fernandes")).toBe("NF");
    });

    it("uses one letter for a single-word name", () => {
      expect(initialsOf("Cher")).toBe("C");
    });

    it("skips middle names", () => {
      expect(initialsOf("Ana Sofía Rojas")).toBe("AR");
    });

    it("copes with extra whitespace", () => {
      expect(initialsOf("  Mei Lin   Zhao  ")).toBe("MZ");
    });

    it("does not crash on an empty name", () => {
      expect(initialsOf("")).toBe("?");
    });
  });

  describe("colorIndexOf", () => {
    it("gives the same name the same colour every time", () => {
      expect(colorIndexOf("Tomás Delgado")).toBe(colorIndexOf("Tomás Delgado"));
    });

    it("stays within the palette", () => {
      for (const name of ["A", "Priya Raman", "zzzz", "Grace Mwangi"]) {
        const i = colorIndexOf(name);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(5);
      }
    });

    it("does not give every name the same colour", () => {
      const names = ["Alex Chen", "Sam Okafor", "Jordan Blake", "Hana Kobayashi", "Marcus Webb"];
      const distinct = new Set(names.map(colorIndexOf));
      expect(distinct.size).toBeGreaterThan(1);
    });
  });

  describe("<CandidateAvatar />", () => {
    it("renders the initials", () => {
      render(<CandidateAvatar name="Nadia Fernandes" />);
      expect(screen.getByTestId("candidate-avatar")).toHaveTextContent("NF");
    });

    it("uses theme tokens rather than hardcoded colours", () => {
      render(<CandidateAvatar name="Nadia Fernandes" />);
      const el = screen.getByTestId("candidate-avatar");
      // No hex codes or Tailwind palette colours — those break the other themes.
      expect(el.className).not.toMatch(/#[0-9a-f]{3,6}/i);
      expect(el.className).not.toMatch(/\b(bg|text)-(red|blue|green|gray|slate|zinc)-\d{3}\b/);
    });

    it("is hidden from screen readers, since the name is already in the row", () => {
      render(<CandidateAvatar name="Nadia Fernandes" />);
      expect(screen.getByTestId("candidate-avatar")).toHaveAttribute("aria-hidden", "true");
    });
  });
});
