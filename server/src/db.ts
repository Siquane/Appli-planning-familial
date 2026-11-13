import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "./env"; // loads .env before DATABASE_URL is read

// Prisma 7 talks to Postgres through a driver adapter (node-postgres).
export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
