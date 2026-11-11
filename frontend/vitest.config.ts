import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests only; e2e/ specs are run by Playwright.
    include: ["src/**/*.test.ts"],
  },
});
