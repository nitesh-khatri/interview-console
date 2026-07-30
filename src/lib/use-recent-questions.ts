"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * "Recently asked" question ids, per browser, in localStorage. Client-only —
 * there's no server round-trip, so the dashboard's server render must not read
 * it. Built on useSyncExternalStore for the same reason as `useResizable`:
 * `getServerSnapshot` returns a stable empty list so hydration matches, then
 * the real value swaps in after mount.
 */

const KEY = "ic-recent-questions";
const MAX = 10;
const EVENT = "ic-recent-questions-change";

/** Cached parse, so getSnapshot returns a stable reference between changes. */
let cache: { raw: string | null; value: number[] } = { raw: null, value: [] };
const EMPTY: number[] = [];

function read(): number[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY; // Safari private mode throws on access
  }
  if (raw === cache.raw) return cache.value;

  let value: number[] = [];
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    // A hand-edited or corrupt value must not take the page down.
    if (Array.isArray(parsed)) {
      value = parsed.filter((n): n is number => typeof n === "number").slice(0, MAX);
    }
  } catch {
    value = [];
  }
  cache = { raw, value };
  return value;
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useRecentQuestions() {
  const recent = useSyncExternalStore(
    subscribe,
    read,
    () => EMPTY // server has no localStorage
  );

  const record = useCallback((id: number) => {
    const current = read();
    // Most-recent first, no duplicates, capped.
    const next = [id, ...current.filter((x) => x !== id)].slice(0, MAX);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // Storage unavailable (private mode / quota): recents just won't persist.
    }
  }, []);

  return { recent, record };
}
