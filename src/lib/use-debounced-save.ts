"use client";

import { useCallback, useEffect, useRef } from "react";

type SaveFn = (key: string, value: unknown) => void | Promise<unknown>;

export interface DebouncedSave {
  /** Queue a save for `key`, resetting that key's debounce timer. */
  trigger: (key: string, value: unknown) => void;
  /**
   * Run every pending save immediately and wait for them to settle.
   * Call this before navigating away or before an action that makes the
   * record read-only, otherwise the in-flight edit is lost.
   */
  flush: () => Promise<void>;
}

/**
 * Debounced persistence keyed by a string — each key debounces independently.
 * Pending saves are flushed on unmount, and can be flushed explicitly via
 * `flush()` when you need to await them.
 */
export function useDebouncedSave(save: SaveFn, delay = 600): DebouncedSave {
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const latest = useRef<Map<string, unknown>>(new Map());
  // `save` is usually an inline arrow, so it changes every render. Keeping the
  // latest one in a ref lets `trigger`/`flush` stay stable without going stale.
  // The write happens in an effect, not during render — refs must not be
  // mutated while rendering.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  const trigger = useCallback(
    (key: string, value: unknown) => {
      latest.current.set(key, value);
      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing);
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key);
          saveRef.current(key, latest.current.get(key));
        }, delay)
      );
    },
    [delay]
  );

  const flush = useCallback(async () => {
    const pending: Promise<unknown>[] = [];
    for (const [key, t] of timers.current.entries()) {
      clearTimeout(t);
      const result = saveRef.current(key, latest.current.get(key));
      if (result) pending.push(Promise.resolve(result));
    }
    timers.current.clear();
    await Promise.allSettled(pending);
  }, []);

  useEffect(() => {
    const timersMap = timers.current;
    const latestMap = latest.current;
    return () => {
      for (const [key, t] of timersMap.entries()) {
        clearTimeout(t);
        saveRef.current(key, latestMap.get(key));
      }
      timersMap.clear();
    };
  }, []);

  return { trigger, flush };
}
