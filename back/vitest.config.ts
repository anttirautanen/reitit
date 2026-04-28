import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    // Disable parallelism so future Postgres-backed integration tests
    // do not race on the same database. With Vitest 4 the previous
    // `poolOptions.forks.singleFork` is expressed via top-level
    // `maxWorkers: 1` plus `fileParallelism: false`.
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
  },
})
