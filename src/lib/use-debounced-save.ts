"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SaveFn = (key: string, value: unknown) => void | Promise<unknown>;

/**
 * `idle`   — nothing typed yet, so there is nothing to report.
 * `saving` — at least one write is queued or in flight.
 * `saved`  — everything queued has been written.
 * `error`  — the last write failed and the edit is not safe.
 */
export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface DebouncedSave {
  /** Queue a save for `key`, resetting that key's debounce timer. */
  trigger: (key: string, value: unknown) => void;
  /**
   * Run every pending save immediately and wait for them to settle.
   * Call this before navigating away or before an action that makes the
   * record read-only, otherwise the in-flight edit is lost.
   */
  flush: () => Promise<void>;
  /** What to show the user about whether their work is safe. */
  status: SaveStatus;
  /** Re-send whatever failed. No-op unless `status` is "error". */
  retry: () => Promise<void>;
}

/**
 * Debounced persistence keyed by a string — each key debounces independently.
 * Pending saves are flushed on unmount, and can be flushed explicitly via
 * `flush()` when you need to await them.
 *
 * Tracks a status so the UI can tell the user whether their notes are safe.
 * Interview notes are the whole point of the console; silently dropping them is
 * the worst thing this hook could do.
 */
export function useDebouncedSave(save: SaveFn, delay = 600): DebouncedSave {
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const latest = useRef<Map<string, unknown>>(new Map());
  /** Values whose write failed, kept so `retry()` re-sends the real edit. */
  const failed = useRef<Map<string, unknown>>(new Map());
  /** Counts writes in flight, so two quick edits can't leave a stuck "Saving…". */
  const inFlight = useRef(0);

  const [status, setStatus] = useState<SaveStatus>("idle");

  // `save` is usually an inline arrow, so it changes every render. Keeping the
  // latest one in a ref lets `trigger`/`flush` stay stable without going stale.
  // The write happens in an effect, not during render — refs must not be
  // mutated while rendering.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  /** Runs one save, keeping the in-flight count and status in step. */
  const run = useCallback((key: string, value: unknown) => {
    inFlight.current += 1;
    setStatus("saving");

    return Promise.resolve(saveRef.current(key, value)).then(
      () => {
        inFlight.current -= 1;
        failed.current.delete(key);
        // A later edit may already be queued, and an earlier failure must not
        // be papered over by a success elsewhere.
        if (inFlight.current === 0 && timers.current.size === 0) {
          setStatus(failed.current.size > 0 ? "error" : "saved");
        }
      },
      (err) => {
        inFlight.current -= 1;
        failed.current.set(key, value);
        setStatus("error");
        throw err;
      }
    );
  }, []);

  const trigger = useCallback(
    (key: string, value: unknown) => {
      latest.current.set(key, value);
      setStatus("saving");

      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing);
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key);
          // Swallow here: `run` has already recorded the failure in `status`,
          // and an unhandled rejection would be noise.
          void run(key, latest.current.get(key)).catch(() => {});
        }, delay)
      );
    },
    [delay, run]
  );

  const flush = useCallback(async () => {
    const pending: Promise<unknown>[] = [];
    for (const [key, t] of timers.current.entries()) {
      clearTimeout(t);
      pending.push(run(key, latest.current.get(key)).catch(() => {}));
    }
    timers.current.clear();
    await Promise.allSettled(pending);
  }, [run]);

  const retry = useCallback(async () => {
    const entries = [...failed.current.entries()];
    if (entries.length === 0) return;
    failed.current.clear();
    await Promise.allSettled(
      entries.map(([key, value]) => run(key, value).catch(() => {}))
    );
  }, [run]);

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

  return { trigger, flush, status, retry };
}

/**
 * Combines several savers into the one answer the user cares about: "is my work
 * safe?". Pessimistic on purpose — a single failure outweighs any number of
 * successes, because the failure is the part that loses data.
 */
export function combineSaveStatus(statuses: SaveStatus[]): SaveStatus {
  if (statuses.includes("error")) return "error";
  if (statuses.includes("saving")) return "saving";
  if (statuses.includes("saved")) return "saved";
  return "idle";
}
