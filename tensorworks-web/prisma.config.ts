import { defineConfig } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Falls back to a dummy URL so `prisma generate` works in CI without a live database.
    // The actual DATABASE_URL is required at runtime via lib/prisma.ts.
    url: process.env.DATABASE_URL ?? "postgresql://ci:ci@localhost:5432/ci",
  },
});
