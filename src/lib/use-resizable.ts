"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

/**
 * Drag-to-resize width state, persisted to localStorage.
 * Returns the current width, a mousedown handler for the drag handle, and
 * whether a drag is in progress.
 */

const CHANGE_EVENT = "ic-resizable-change";

/**
 * Live widths, keyed by storage key. This cache exists so `getSnapshot` can
 * return a stable number without reading localStorage on every render — a
 * snapshot that returns a fresh value each call makes React re-render forever.
 */
const widths = new Map<string, number>();

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

export function useResizable(
  storageKey: string,
  defaultWidth: number,
  min = 280,
  max = 620
) {
  const [dragging, setDragging] = useState(false);

  // Reads localStorage once per key, then serves the cached width.
  const getSnapshot = useCallback(() => {
    const cached = widths.get(storageKey);
    if (cached !== undefined) return cached;

    const stored = Number(localStorage.getItem(storageKey));
    const initial =
      Number.isFinite(stored) && stored > 0 ? clamp(stored, min, max) : defaultWidth;
    widths.set(storageKey, initial);
    return initial;
  }, [storageKey, defaultWidth, min, max]);

  // The server has no localStorage, so it renders the default. React swaps to
  // the stored width after hydration instead of warning about a mismatch.
  const getServerSnapshot = useCallback(() => defaultWidth, [defaultWidth]);

  const width = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const commit = useCallback(
    (next: number, persist: boolean) => {
      widths.set(storageKey, next);
      // Only persist when the drag ends — a write per mousemove is wasteful.
      if (persist) localStorage.setItem(storageKey, String(next));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [storageKey]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = getSnapshot();
      let latest = startWidth;
      setDragging(true);

      function onMove(ev: MouseEvent) {
        latest = clamp(startWidth + (ev.clientX - startX), min, max);
        commit(latest, false);
      }
      function onUp() {
        setDragging(false);
        commit(latest, true);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      }
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [getSnapshot, commit, min, max]
  );

  return { width, onMouseDown, dragging };
}
