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
    // These are heavy integration tests — several render the whole interview
    // console and drive it with userEvent. Running every file in parallel
    // starves the workers and userEvent's waitFor calls time out, so the suite
    // flakes even though each file passes on its own. One worker at a time
    // keeps it deterministic; a generous timeout covers the slowest render.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
