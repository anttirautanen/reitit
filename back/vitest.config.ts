import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    // Load `back/.env` into the test environment the same way `main.ts` does,
    // so `pnpm --filter @reitit/back test` picks up `TEST_DATABASE_URL` and
    // `DIGITRANSIT_API_KEY` without the caller exporting them first. dotenv
    // never overrides variables already present in the environment, so CI (or
    // a shell that exports its own values) still takes precedence.
    setupFiles: ["dotenv/config"],
    // Disable parallelism so future Postgres-backed integration tests
    // do not race on the same database. With Vitest 4 the previous
    // `poolOptions.forks.singleFork` is expressed via top-level
    // `maxWorkers: 1` plus `fileParallelism: false`.
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
  },
})
