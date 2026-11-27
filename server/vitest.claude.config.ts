import { defineConfig } from "vitest/config";

// Pour les sessions Claude : Prisma refuse `db push --force-reset` (le
// globalSetup de vitest.config.ts) lancé par un agent. Préparer la base avec
// `npx prisma migrate deploy`, puis `npx vitest run -c vitest.claude.config.ts`.
// Mêmes réglages que vitest.config.ts, sans globalSetup.
export default defineConfig({
  test: { environment: "node", setupFiles: ["./tests/setupEnv.ts"], hookTimeout: 20000, fileParallelism: false },
});
