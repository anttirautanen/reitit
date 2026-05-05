/**
 * Thin wrapper around fetch for Digitransit GraphQL POST calls.
 *
 * The `DigitransitClient` interface is the seam tests use: production code
 * receives the client via dependency injection so tests can supply a fake
 * implementation without monkey-patching globals.
 */

const DIGITRANSIT_GRAPHQL_URL = "https://api.digitransit.fi/routing/v2/hsl/gtfs/v1"

const ERROR_SNIPPET_MAX_LENGTH = 500

export interface DigitransitClient {
  query<T>(query: string, variables?: Record<string, unknown>): Promise<T>
}

interface DigitransitUpstreamErrorOptions {
  upstreamStatus: number | null
  cause?: unknown
}

export class DigitransitUpstreamError extends Error {
  readonly upstreamStatus: number | null
  override readonly cause: unknown

  constructor(message: string, options: DigitransitUpstreamErrorOptions) {
    super(message)
    this.name = "DigitransitUpstreamError"
    this.upstreamStatus = options.upstreamStatus
    this.cause = options.cause
  }
}

export function createDigitransitClient(deps: { apiKey: string }): DigitransitClient {
  const { apiKey } = deps

  return {
    async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
      const body: { query: string; variables?: Record<string, unknown> } = { query }
      if (variables !== undefined) {
        body.variables = variables
      }

      let response: Response
      try {
        response = await fetch(DIGITRANSIT_GRAPHQL_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "digitransit-subscription-key": apiKey,
          },
          body: JSON.stringify(body),
        })
      } catch (error) {
        throw new DigitransitUpstreamError("Digitransit request failed", {
          upstreamStatus: null,
          cause: error,
        })
      }

      if (!response.ok) {
        const text = await safeReadText(response)
        throw new DigitransitUpstreamError(`Digitransit upstream returned ${String(response.status)}: ${truncate(text)}`, {
          upstreamStatus: response.status,
        })
      }

      let parsed: unknown
      try {
        parsed = await response.json()
      } catch (error) {
        throw new DigitransitUpstreamError("Failed to parse Digitransit response", {
          upstreamStatus: null,
          cause: error,
        })
      }

      if (parsed !== null && typeof parsed === "object" && "errors" in parsed) {
        const errors = (parsed as { errors: unknown }).errors
        if (Array.isArray(errors) && errors.length > 0) {
          throw new DigitransitUpstreamError(`Digitransit returned GraphQL errors: ${truncate(JSON.stringify(errors))}`, {
            upstreamStatus: response.status,
          })
        }
      }

      if (parsed === null || typeof parsed !== "object" || !("data" in parsed)) {
        throw new DigitransitUpstreamError("Digitransit response missing data field", {
          upstreamStatus: response.status,
        })
      }

      return (parsed as { data: T }).data
    },
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ""
  }
}

function truncate(text: string): string {
  if (text.length <= ERROR_SNIPPET_MAX_LENGTH) return text
  return text.slice(0, ERROR_SNIPPET_MAX_LENGTH) + "..."
}
