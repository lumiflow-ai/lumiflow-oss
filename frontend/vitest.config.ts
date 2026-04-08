import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineBrowserCommand, playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const isRunningInVitestVSCode = ["1", "true"].includes(process.env.VITEST_VSCODE ?? "");

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env": JSON.stringify({}),
  },
  test: {
    browser: {
      provider: playwright({
        contextOptions: {
          deviceScaleFactor: 2,
        },
      }),
      enabled: true,
      headless: true,
      viewport: { width: 1280, height: 720 },
      instances: [{ browser: "chromium" }, { browser: "firefox" }, { browser: "webkit" }],
      commands: {
        emulateMedia: defineBrowserCommand(({ page }, options: { media: "print" | "screen" }) => {
          return page.emulateMedia(options);
        }),
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["**/*.test.{ts,tsx}"],
          environment: "node",
          browser: { enabled: false },
        },
      },
      {
        extends: true,
        test: {
          name: "snapshot",
          setupFiles: ["./vitestSetup.ts"],
          include: ["**/*.test.snapshot.{ts,tsx}"],
        },
      },
    ].filter((project) => !isRunningInVitestVSCode || project.test.name !== "snapshot"),
  },
  resolve: {
    alias: {
      // Match the TypeScript path aliases
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
