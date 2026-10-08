import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  test: {
    environment: "jsdom",
    testTimeout: 20000, // Allow slower shared Gitea runners to complete UI tests.
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: true,

    include: [
      "src/**/*.test.{ts,tsx}",
      "src/**/*.spec.{ts,tsx}",
    ],

    exclude: [
      "e2e/**",
      "tests/**",
      "node_modules/**",
    ],

    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/**/*.d.ts",
        "src/test/**",
      ],
    },
  },
});