import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/** Serves the static export in out/ through the FastAPI backend, as in production. */
const serve = `cd ../backend && uv run uvicorn backend.main:app --port ${PORT}`;

/**
 * End-to-end tests run against the production build, served on a port that
 * won't clash with a local `npm run dev` on 3000 or the app on 8000. CI builds
 * in an earlier step, so it only needs to start the server.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.CI ? serve : `npm run build && ${serve}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
