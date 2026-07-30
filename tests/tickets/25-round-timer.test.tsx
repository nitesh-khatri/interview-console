import { describe, it, expect, beforeAll } from "vitest";

/**
 * Ticket #25 — Round timer shows nonsense on completed rounds
 *
 * Remove `.skip` from `describe.skip` below, then make these pass.
 *
 * Several of these fail on today's code and pass once it's fixed.
 *
 * The formatting and the duration maths are pure exported functions, taking
 * their inputs as arguments — a timer that reads the clock internally can't be
 * tested. This file assumes:
 *   - formatDuration(totalSeconds) from src/lib/client.ts
 *   - roundDurationSeconds(status, startedAt, completedAt, now?) from the same
 *
 * (If you name them differently, update the imports below to match.)
 */
type Mod = typeof import("@/lib/client");
let formatDuration: Mod["formatDuration"];
let roundDurationSeconds: Mod["roundDurationSeconds"];

const at = (iso: string) => iso.replace("T", " ").replace("Z", ""); // SQLite shape

describe("ticket 25 — round timer", () => {
  beforeAll(async () => {
    ({ formatDuration, roundDurationSeconds } = await import("@/lib/client"));
  });

  describe("formatDuration", () => {
    it("formats under a minute as mm:ss", () => {
      expect(formatDuration(42)).toBe("00:42");
    });

    it("formats minutes and seconds", () => {
      expect(formatDuration(52 * 60 + 18)).toBe("52:18");
    });

    it("shows hours once past 60 minutes", () => {
      // The old mm:ss-only format rendered this as "84:30".
      expect(formatDuration(84 * 60 + 30)).toBe("1:24:30");
    });

    it("never goes negative", () => {
      expect(formatDuration(-10)).toBe("00:00");
    });
  });

  describe("roundDurationSeconds", () => {
    const NOW = new Date("2026-07-30T10:00:00Z");

    it("is null for a pending round", () => {
      expect(roundDurationSeconds("pending", null, null, NOW)).toBeNull();
    });

    it("counts up from started_at while in progress", () => {
      const started = at("2026-07-30T09:30:00Z"); // 30 min ago
      expect(roundDurationSeconds("in_progress", started, null, NOW)).toBe(30 * 60);
    });

    it("uses completed_at minus started_at for a completed round", () => {
      const started = at("2026-07-25T14:00:00Z");
      const completed = at("2026-07-25T14:52:00Z");
      // 52 minutes — NOT the days since, which is the bug.
      expect(
        roundDurationSeconds("completed", started, completed, NOW)
      ).toBe(52 * 60);
    });

    it("does not keep growing after a round is completed", () => {
      const started = at("2026-07-25T14:00:00Z");
      const completed = at("2026-07-25T14:45:00Z");
      const later = new Date("2026-08-10T00:00:00Z");
      expect(roundDurationSeconds("completed", started, completed, later)).toBe(
        45 * 60
      );
    });

    it("is null for a completed round missing its completed_at", () => {
      const started = at("2026-07-25T14:00:00Z");
      // Older data: degrade gracefully rather than counting to now.
      expect(roundDurationSeconds("completed", started, null, NOW)).toBeNull();
    });
  });
});
