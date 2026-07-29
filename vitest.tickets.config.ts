import { defineConfig } from "vitest/config";

/**
 * Runs the per-ticket tests only.
 *
 *   npm run test:ticket 02      # just ticket 2's test
 *   npm run test:tickets        # every ticket test
 *
 * These live in their own config because a ticket you haven't started yet
 * imports files that don't exist, which would fail the main suite.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/tickets/**/*.test.{ts,tsx}"],
    css: false,
  },
});
