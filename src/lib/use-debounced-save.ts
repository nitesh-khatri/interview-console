"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SaveFn = (key: string, value: unknown) => void | Promise<unknown>;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface DebouncedSave {
  /** Queue a save for `key`, resetting that key's debounce timer. */
  trigger: (key: string, value: unknown) => void;

  /**
   * Retry the most recently failed save(s).
   */
  retry: () => Promise<void>;

  /**
   * Run every pending save immediately and wait for them to settle.
   * Call this before navigating away or before an action that makes the
   * record read-only, otherwise the in-flight edit is lost.
   */
  flush: () => Promise<void>;

  /** Current persistence status. */
  status: SaveStatus;
}

/**
 * Debounced persistence keyed by a string — each key debounces independently.
 * Pending saves are flushed on unmount, and can be flushed explicitly via
 * `flush()` when you need to await them.
 */
export function useDebouncedSave(save: SaveFn, delay = 600): DebouncedSave {
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const latest = useRef<Map<string, unknown>>(new Map());

  // Keep the latest save function without making trigger/flush unstable.
  const saveRef = useRef(save);

  // Keep track of values that failed so retry() can resend them.
  const failed = useRef<Map<string, unknown>>(new Map());

  // Track saves currently in flight.
  const inFlight = useRef<Set<Promise<unknown>>>(new Set());

  const [status, setStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    saveRef.current = save;
  });

  const performSave = useCallback(
    async (key: string, value: unknown) => {
      setStatus("saving");

      const request = Promise.resolve(saveRef.current(key, value));
      inFlight.current.add(request);

      try {
        await request;

        failed.current.delete(key);

        if (inFlight.current.size === 1) {
          // This was the last in-flight save.
          setStatus("saved");
        }
      } catch (error) {
        failed.current.set(key, value);
        setStatus("error");
        throw error;
      } finally {
        inFlight.current.delete(request);

        if (inFlight.current.size > 0) {
          return;
        }

        if (failed.current.size > 0) {
          setStatus("error");
        }
      }
    },
    [],
  );

  const trigger = useCallback(
    (key: string, value: unknown) => {
      latest.current.set(key, value);

      // A new edit supersedes an old failed value for this key.
      failed.current.delete(key);

      setStatus("saving");

      const existing = timers.current.get(key);

      if (existing) {
        clearTimeout(existing);
      }

      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key);

          void performSave(key, latest.current.get(key)).catch(() => {
            // performSave already updates the status.
          });
        }, delay),
      );
    },
    [delay, performSave],
  );

  const flush = useCallback(async () => {
    const pending: Promise<unknown>[] = [];

    for (const [key, timer] of timers.current.entries()) {
      clearTimeout(timer);

      const value = latest.current.get(key);

      pending.push(
        performSave(key, value).catch(() => {
          // Preserve the error status while allowing flush() to settle.
        }),
      );
    }

    timers.current.clear();

    // Also wait for saves that were already in flight.
    pending.push(...Array.from(inFlight.current));

    await Promise.allSettled(pending);
  }, [performSave]);

  const retry = useCallback(async () => {
    const entries = Array.from(failed.current.entries());

    if (entries.length === 0) {
      return;
    }

    setStatus("saving");

    const retries = entries.map(([key, value]) =>
      performSave(key, value).catch(() => {
        // performSave already sets error status.
      }),
    );

    await Promise.allSettled(retries);
  }, [performSave]);

  useEffect(() => {
    const timersMap = timers.current;
    const latestMap = latest.current;

    return () => {
      for (const [key, timer] of timersMap.entries()) {
        clearTimeout(timer);

        void saveRef.current(key, latestMap.get(key));
      }

      timersMap.clear();
    };
  }, []);

  return {
    trigger,
    retry,
    flush,
    status,
  };
}

/**
 * Combine multiple save statuses into one pessimistic status.
 *
 * Error wins over saving, saving wins over saved, and saved wins over idle.
 */
export function combineSaveStatus(statuses: SaveStatus[]): SaveStatus {
  if (statuses.includes("error")) {
    return "error";
  }

  if (statuses.includes("saving")) {
    return "saving";
  }

  if (statuses.includes("saved")) {
    return "saved";
  }

  return "idle";
}