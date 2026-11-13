import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7: connection URLs live here instead of in schema.prisma.
// DATABASE_URL is used by `migrate deploy` (Render) and `db push` (tests);
// SHADOW_DATABASE_URL only by `migrate diff` in CI. Read without env() so
// commands that don't need a database (generate) work without them.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
