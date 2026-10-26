import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    // Integrationstests teilen sich eine Datenbank → nacheinander ausführen
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
