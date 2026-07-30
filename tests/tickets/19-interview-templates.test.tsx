import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Ticket #19 — Interview templates
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * Contract:
 *   - data-testid="save-template-button", data-testid="apply-template-button"
 *   - data-testid="template-<id>" per template in the picker
 *
 * `api()` is mocked. GET /api/templates returns saved templates; POST creates
 * one. Applying reuses the console's own add flow via the onApply prop.
 */

const api = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));

vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return { ...actual, api };
});
vi.mock("sonner", () => ({ toast, Toaster: () => null }));

let TemplatesMenu: typeof import("@/components/console/templates-menu").TemplatesMenu;

describe("ticket 19 — interview templates", () => {
  beforeAll(async () => {
    ({ TemplatesMenu } = await import("@/components/console/templates-menu"));
  });

  beforeEach(() => {
    api.mockReset();
    toast.error.mockReset();
    toast.success.mockReset();
  });

  const templates = [
    { id: 1, name: "Frontend screen", question_count: 2, questions: [{ id: 10 }, { id: 11 }] },
    { id: 2, name: "Deep dive", question_count: 1, questions: [{ id: 20 }] },
  ];

  it("saves the current questions as a named template", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({ id: 99 });
    render(
      <TemplatesMenu
        askedQuestionIds={[10, 11]}
        hasAdhoc={false}
        onApply={() => 0}
      />
    );

    await user.click(screen.getByTestId("save-template-button"));
    await user.type(screen.getByLabelText(/name/i), "My template");
    await user.click(screen.getByRole("button", { name: /save template/i }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith(
        "/api/templates",
        expect.objectContaining({ method: "POST" })
      )
    );
    const body = JSON.parse(api.mock.calls[0][1].body);
    expect(body.name).toBe("My template");
    expect(body.question_ids).toEqual([10, 11]);
  });

  it("won't save an empty round", async () => {
    const user = userEvent.setup();
    render(
      <TemplatesMenu askedQuestionIds={[]} hasAdhoc={false} onApply={() => 0} />
    );
    await user.click(screen.getByTestId("save-template-button"));
    await user.type(screen.getByLabelText(/name/i), "Empty");
    await user.click(screen.getByRole("button", { name: /save template/i }));
    expect(toast.error).toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
  });

  it("lists saved templates in the picker", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({ templates });
    render(
      <TemplatesMenu askedQuestionIds={[]} hasAdhoc={false} onApply={() => 0} />
    );
    await user.click(screen.getByTestId("apply-template-button"));
    await waitFor(() =>
      expect(screen.getByTestId("template-1")).toBeInTheDocument()
    );
    expect(screen.getByTestId("template-2")).toHaveTextContent("Deep dive");
  });

  it("applies a template and reports how many were added", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({ templates });
    const onApply = vi.fn().mockReturnValue(2); // both new
    render(
      <TemplatesMenu askedQuestionIds={[]} hasAdhoc={false} onApply={onApply} />
    );
    await user.click(screen.getByTestId("apply-template-button"));
    await waitFor(() => screen.getByTestId("template-1"));
    await user.click(screen.getByTestId("template-1"));

    expect(onApply).toHaveBeenCalledWith([10, 11]);
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/added 2/i));
  });

  it("says what it skipped when some questions are already in the round", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({ templates });
    const onApply = vi.fn().mockReturnValue(1); // one of two was new
    render(
      <TemplatesMenu askedQuestionIds={[10]} hasAdhoc={false} onApply={onApply} />
    );
    await user.click(screen.getByTestId("apply-template-button"));
    await waitFor(() => screen.getByTestId("template-1"));
    await user.click(screen.getByTestId("template-1"));

    expect(toast.success).toHaveBeenCalledWith(
      expect.stringMatching(/already in the round/i)
    );
  });

  it("notes that ad-hoc questions are excluded when saving", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({ id: 1 });
    render(
      <TemplatesMenu askedQuestionIds={[10]} hasAdhoc onApply={() => 0} />
    );
    await user.click(screen.getByTestId("save-template-button"));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/ad-hoc/i);
  });

  it("shows an empty state when there are no templates", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({ templates: [] });
    render(
      <TemplatesMenu askedQuestionIds={[]} hasAdhoc={false} onApply={() => 0} />
    );
    await user.click(screen.getByTestId("apply-template-button"));
    await waitFor(() =>
      expect(screen.getByText(/no templates yet/i)).toBeInTheDocument()
    );
  });
});
