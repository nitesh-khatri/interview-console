import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders as render } from "../fixtures/render";
import { consoleProps } from "../fixtures/console";

/**
 * Ticket #14 — Drag-and-drop reorder of asked questions
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * Contract:
 *   - each card carries data-testid="asked-question-<id>"
 *   - each drag handle carries data-testid="drag-handle-<id>" and is keyboard
 *     reorderable: ArrowUp / ArrowDown while it has focus
 *
 * The reorder endpoint takes { ordered_ids: number[] } — see docs/API.md.
 *
 * jsdom has no real drag-and-drop, so the drag path is exercised by firing the
 * dragstart/dragover/drop events directly. The keyboard path is the one a user
 * without a mouse relies on, and it's fully testable here.
 */

const api = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));

vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return { ...actual, api };
});
vi.mock("sonner", () => ({ toast, Toaster: () => null }));

let InterviewConsole: typeof import("@/components/console/interview-console").InterviewConsole;

describe("ticket 14 — reorder asked questions", () => {
  beforeAll(async () => {
    ({ InterviewConsole } = await import(
      "@/components/console/interview-console"
    ));
  });

  beforeEach(() => {
    api.mockReset().mockResolvedValue({});
  });

  const renderConsole = (over: Record<string, unknown> = {}) =>
    render(<InterviewConsole {...(consoleProps(over) as never)} />);

  /** The ids of the asked-question cards, top to bottom. */
  const order = () =>
    screen
      .getAllByTestId(/^asked-question-/)
      .map((el) => el.getAttribute("data-testid")!.replace("asked-question-", ""));

  /** The ordered_ids sent by the most recent reorder request. */
  const lastReorderBody = () => {
    const call = [...api.mock.calls]
      .reverse()
      .find((c) => String(c[0]).includes("/reorder"));
    return call ? JSON.parse((call[1] as { body: string }).body) : null;
  };

  it("starts in the given order", () => {
    renderConsole();
    expect(order()).toEqual(["1", "2", "3"]);
  });

  it("moves a question down with ArrowDown on its handle", async () => {
    renderConsole();
    const handle = screen.getByTestId("drag-handle-1");
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowDown" });

    await waitFor(() => expect(order()).toEqual(["2", "1", "3"]));
  });

  it("moves a question up with ArrowUp on its handle", async () => {
    renderConsole();
    const handle = screen.getByTestId("drag-handle-3");
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowUp" });

    await waitFor(() => expect(order()).toEqual(["1", "3", "2"]));
  });

  it("does nothing when the top item is moved up", () => {
    renderConsole();
    const handle = screen.getByTestId("drag-handle-1");
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(order()).toEqual(["1", "2", "3"]);
    expect(api).not.toHaveBeenCalled();
  });

  it("persists the new order as ordered_ids", async () => {
    renderConsole();
    const handle = screen.getByTestId("drag-handle-1");
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowDown" });

    await waitFor(() => expect(lastReorderBody()).not.toBeNull());
    expect(lastReorderBody().ordered_ids).toEqual([2, 1, 3]);
  });

  it("sends one request per move, not one per position", async () => {
    renderConsole();
    const handle = screen.getByTestId("drag-handle-1");
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    await waitFor(() => expect(order()).toEqual(["2", "1", "3"]));

    const reorderCalls = api.mock.calls.filter((c) =>
      String(c[0]).includes("/reorder")
    );
    expect(reorderCalls).toHaveLength(1);
  });

  it("reorders via drag and drop", async () => {
    renderConsole();
    const handle = screen.getByTestId("drag-handle-1");
    const target = screen.getByTestId("asked-question-3");

    const dt = { data: {} as Record<string, string>, setData() {}, getData() {} };
    fireEvent.dragStart(handle, { dataTransfer: dt });
    fireEvent.dragOver(target, { dataTransfer: dt });
    fireEvent.drop(target, { dataTransfer: dt });

    await waitFor(() => expect(order()).toEqual(["2", "3", "1"]));
  });

  it("rolls back to the original order when the request fails", async () => {
    api.mockRejectedValue(new Error("offline"));
    renderConsole();
    const handle = screen.getByTestId("drag-handle-1");
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowDown" });

    // Briefly optimistic, then back to the start once the server refuses.
    await waitFor(() => expect(order()).toEqual(["1", "2", "3"]));
    expect(toast.error).toHaveBeenCalled();
  });

  it("has no drag handles in a read-only round", () => {
    renderConsole({ readOnly: true });
    expect(screen.queryByTestId("drag-handle-1")).not.toBeInTheDocument();
  });

  it("gives each handle an accessible name", () => {
    renderConsole();
    expect(screen.getByTestId("drag-handle-1")).toHaveAccessibleName();
  });
});
