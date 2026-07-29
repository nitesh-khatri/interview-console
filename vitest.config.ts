import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolves the `@/*` alias from tsconfig.json so tests import exactly the
    // way application code does.
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // Per-ticket tests are excluded here because a ticket you haven't started
    // yet imports files that don't exist, which would fail the whole run.
    // Run those with `npm run test:ticket <number>` instead.
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/tickets/**", "node_modules/**"],
    css: false,
  },
});
