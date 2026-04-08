import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use Node.js environment for backend tests
    environment: "node",
  },
  resolve: {
    alias: {
      // Match the TypeScript path aliases
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
