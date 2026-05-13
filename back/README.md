# @reitit/back

Express + Drizzle backend for the Reitit route view.

## Tests

```
TEST_DATABASE_URL=postgres://<user>@<host>:<port>/<db> pnpm --filter @reitit/back test
```

The integration tests apply the migrations against `TEST_DATABASE_URL`, seed fixtures via helpers in `src/__tests__/setup.ts`, and truncate all `public` tables between tests. They will refuse to run if `TEST_DATABASE_URL` is unset — never falls back to `DATABASE_URL`.

The frontend tests run in jsdom with no external dependencies:

```
pnpm --filter @reitit/front test
```
