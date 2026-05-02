import { defineConfig } from 'drizzle-kit'
import dotenv from 'dotenv'
dotenv.config()

export default defineConfig({
  schema: './api/_lib/tournament-schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
