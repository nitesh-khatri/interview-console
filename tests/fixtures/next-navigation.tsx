import { useSyncExternalStore } from "react";
import { vi } from "vitest";

/**
 * A stateful stand-in for the App Router.
 *
 * The global mock in `tests/setup.ts` is deliberately inert — it returns an
 * empty query string and a no-op router, which is all most components need. A
 * component that keeps state *in the URL* needs more than that: pushing has to
 * actually change what `useSearchParams()` returns, and it has to re-render.
 *
 * Use it from a test file like this:
 *
 *   vi.mock("next/navigation", async () => {
 *     const { navigation } = await import("../fixtures/next-navigation");
 *     return navigation;
 *   });
 *
 * Then `resetUrl()` in a `beforeEach`, and read `history` to assert on whether
 * a change pushed a new entry or replaced the current one.
 */

let search = "";
const listeners = new Set<() => void>();

/** Every navigation, in order, so tests can check push vs replace. */
export const history: { url: string; type: "push" | "replace" }[] = [];

function notify() {
  for (const l of listeners) l();
}

export function resetUrl(initial = "") {
  search = initial;
  history.length = 0;
  notify();
}

/** The current query string, e.g. `?q=alex&sort=score`. */
export function currentSearch() {
  return search;
}

function navigate(url: string, type: "push" | "replace") {
  history.push({ url, type });
  const i = url.indexOf("?");
  search = i === -1 ? "" : url.slice(i);
  notify();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

const getSnapshot = () => search;

export const navigation = {
  useRouter: () => ({
    push: (url: string) => navigate(url, "push"),
    replace: (url: string) => navigate(url, "replace"),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/candidates",
  useSearchParams: () => {
    // A primitive snapshot keeps this stable across renders; the
    // URLSearchParams wrapper is rebuilt each time, which is what Next does.
    const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    return new URLSearchParams(s);
  },
  redirect: vi.fn(),
  notFound: vi.fn(),
};
