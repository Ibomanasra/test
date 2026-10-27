import { defineConfig } from "vitest/config";

// Nur reine Logik (src/lib) wird mit Vitest getestet – UI läuft in Expo
export default defineConfig({ test: { include: ["src/lib/**/*.test.ts"] } });
