import { TEST_DATABASE_URL } from "./testDbUrl";

// Must run before src/env.ts (which does `import "dotenv/config"`) is
// imported anywhere — dotenv never overrides an already-set process.env
// var, so setting this first pins every test worker to the disposable
// test DB instead of prisma/dev.db.
process.env.DATABASE_URL = TEST_DATABASE_URL;

// Auth rate limits would trip on the many signups the suite performs;
// tests/routes/rateLimits.test.ts turns them back on for itself.
process.env.DISABLE_RATE_LIMIT = "1";
