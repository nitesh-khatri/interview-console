import { describe, it, expect, beforeAll, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders as render } from "../fixtures/render";
import type { Question } from "@/lib/types";

/**
 * Ticket #15 — Search results hidden behind collapsed categories
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * Several of these fail on today's code and pass once it's fixed.
 *
 * These drive the console's question bank panel, since that is where the bug
 * bites hardest — you are mid-interview and search looks broken. Fix the
 * Question Bank page the same way; the acceptance criteria cover both.
 *
 * The assertions go through `shows()`, which tests the panel's rendered text
 * rather than looking for one text node. A collapsed category renders none of
 * its questions at all, so "is this text on screen" is exactly the right
 * question — and it keeps passing if you wrap matches in <mark> for ticket #10,
 * which splits the text across several elements.
 */
let QuestionBankPanel: typeof import("@/components/console/question-bank-panel").QuestionBankPanel;

type BankQuestion = Question & { bank_name: string };

const q = (
  id: number,
  category: string,
  question: string,
  difficulty: Question["difficulty"] = "easy"
): BankQuestion =>
  ({
    id,
    bank_id: 1,
    bank_name: "Frontend",
    category,
    question,
    difficulty,
    qtype: "theory",
    answer_hints: null,
    follow_ups: null,
    created_at: "2026-07-01 10:00:00",
  }) as BankQuestion;

const QUESTIONS: BankQuestion[] = [
  q(1, "CSS", "How does flexbox distribute free space?"),
  q(2, "CSS", "What is the difference between em and rem?"),
  q(3, "JavaScript", "Explain the event loop."),
  q(4, "JavaScript", "What does flexbox have to do with JS? Nothing."),
  q(5, "React", "When does a component re-render?"),
];

describe("ticket 15 — search reveals its results", () => {
  beforeAll(async () => {
    ({ QuestionBankPanel } = await import(
      "@/components/console/question-bank-panel"
    ));
  });

  const renderPanel = () =>
    render(
      <QuestionBankPanel
        banks={[{ id: 1, name: "Frontend" }]}
        bankQuestions={QUESTIONS}
        askedIds={new Set()}
        onAsk={vi.fn()}
        onAskAdhoc={vi.fn()}
        readOnly={false}
      />
    );

  const search = () => screen.getByTestId("search-input");

  /** Is this text rendered anywhere in the panel? */
  const shows = (re: RegExp) => re.test(document.body.textContent ?? "");

  const FLEXBOX_CSS = /How does flexbox distribute free space/;
  const FLEXBOX_JS = /What does flexbox have to do with JS/;
  const RERENDER = /When does a component re-render/;

  it("starts with categories collapsed", () => {
    renderPanel();
    expect(screen.getByText("CSS")).toBeInTheDocument();
    // The question text is not rendered until a category is opened.
    expect(shows(FLEXBOX_CSS)).toBe(false);
  });

  it("shows matching questions without any extra clicks", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.type(search(), "flexbox");

    // This is the bug: the matches were there, but every category stayed shut,
    // so the panel looked like it had found nothing.
    await waitFor(() => expect(shows(FLEXBOX_CSS)).toBe(true));
  });

  it("reveals matches across more than one category", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.type(search(), "flexbox");

    await waitFor(() => expect(shows(FLEXBOX_CSS)).toBe(true));
    expect(shows(FLEXBOX_JS)).toBe(true);
  });

  it("hides categories with no matches rather than showing them empty", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.type(search(), "flexbox");

    await waitFor(() => expect(screen.queryByText("React")).not.toBeInTheDocument());
  });

  it("says so when nothing matches", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.type(search(), "zzzznothing");

    await waitFor(() =>
      expect(screen.getByText(/nothing matches|no questions/i)).toBeInTheDocument()
    );
  });

  it("lets the user collapse a category while searching, and it stays collapsed", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.type(search(), "flexbox");
    await waitFor(() => expect(shows(FLEXBOX_CSS)).toBe(true));

    // Search opens it; the user's explicit collapse has to win.
    await user.click(screen.getByText("CSS"));
    expect(shows(FLEXBOX_CSS)).toBe(false);
    // The other category is untouched.
    expect(shows(FLEXBOX_JS)).toBe(true);
  });

  it("restores the previous collapsed state when the search is cleared", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(search(), "flexbox");
    await waitFor(() => expect(shows(FLEXBOX_CSS)).toBe(true));

    await user.clear(search());
    // Back to how it was before searching — not everything left hanging open.
    await waitFor(() => expect(shows(FLEXBOX_CSS)).toBe(false));
  });

  it("keeps a category the user opened before searching open afterwards", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByText("React"));
    expect(shows(RERENDER)).toBe(true);

    await user.type(search(), "flexbox");
    await waitFor(() => expect(shows(FLEXBOX_CSS)).toBe(true));

    await user.clear(search());
    await waitFor(() => expect(shows(RERENDER)).toBe(true));
  });
});
