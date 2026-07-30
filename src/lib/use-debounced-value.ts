"use client";

import { useEffect, useState } from "react";

/**
 * Returns a search query delayed by `delay` milliseconds.
 *
 * Use this to keep the input responsive while doing expensive work — filtering a
 * long list, or writing to the URL — only after the user stops typing. The input
 * stays bound to the immediate value; the debounced one drives the work.
 *
 * Clearing is deliberately not delayed. An empty query is returned straight
 * away, so the clear button feels instant instead of lagging by `delay`. That
 * is done by deriving the return value rather than by calling setState from the
 * effect body, which would cause a cascading render.
 */
export function useDebouncedValue(value: string, delay = 250): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return value === "" ? "" : debounced;
}
