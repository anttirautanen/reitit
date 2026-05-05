import { afterEach, describe, expect, it } from "vitest"
import type { StopLinesApiResponse } from "../api.js"
import { DigitransitClient, DigitransitUpstreamError } from "../digitransit/client.js"
import { STOP_LINES_QUERY } from "../digitransit/queries.js"
import { registerStopLinesRoutes } from "../routes/stopLines.js"
import { startTestServer, type TestServer } from "./setup.js"

interface FakeCall {
  query: string
  variables?: Record<string, unknown>
}

interface FakeClient extends DigitransitClient {
  calls: FakeCall[]
}

function fakeClient(impl: (query: string, variables?: Record<string, unknown>) => unknown): FakeClient {
  const calls: FakeCall[] = []
  return {
    query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
      calls.push({ query, variables })
      try {
        return Promise.resolve(impl(query, variables) as T)
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)))
      }
    },
    calls,
  }
}

describe("GET /api/stops/:stopId/lines", () => {
  let running: TestServer | undefined

  afterEach(async () => {
    if (running !== undefined) {
      await running.close()
      running = undefined
    }
  })

  it("returns the reshaped lines for a stop and calls the client once with the right query and variables", async () => {
    const client = fakeClient(() => ({
      stop: {
        routes: [
          { gtfsId: "HSL:1078", shortName: "78", mode: "BUS" },
          { gtfsId: "HSL:550", shortName: "550", mode: "BUS" },
        ],
      },
    }))
    running = await startTestServer((router) => registerStopLinesRoutes(router, { digitransitClient: client }))

    const response = await fetch(`${running.url}/api/stops/HSL:1234/lines`)
    expect(response.status).toBe(200)
    const body = (await response.json()) as StopLinesApiResponse
    expect(body).toEqual({
      lines: [
        { gtfsId: "HSL:1078", shortName: "78", mode: "BUS" },
        { gtfsId: "HSL:550", shortName: "550", mode: "BUS" },
      ],
    })

    expect(client.calls).toHaveLength(1)
    expect(client.calls[0].query).toBe(STOP_LINES_QUERY)
    expect(client.calls[0].variables).toEqual({ stopId: "HSL:1234" })
  })

  it("sorts the lines by shortName in natural order with gtfsId as a stable secondary key", async () => {
    const client = fakeClient(() => ({
      stop: {
        routes: [
          { gtfsId: "HSL:550", shortName: "550", mode: "BUS" },
          { gtfsId: "HSL:10b", shortName: "10", mode: "BUS" },
          { gtfsId: "HSL:10a", shortName: "10", mode: "BUS" },
          { gtfsId: "HSL:94k", shortName: "94K", mode: "BUS" },
          { gtfsId: "HSL:2", shortName: "2", mode: "BUS" },
        ],
      },
    }))
    running = await startTestServer((router) => registerStopLinesRoutes(router, { digitransitClient: client }))

    const response = await fetch(`${running.url}/api/stops/HSL:1234/lines`)
    expect(response.status).toBe(200)
    const body = (await response.json()) as StopLinesApiResponse
    expect(body.lines.map((l) => l.shortName)).toEqual(["2", "10", "10", "94K", "550"])
    // Stable secondary key: identical "10" entries are ordered by gtfsId ascending.
    expect(body.lines.map((l) => l.gtfsId)).toEqual(["HSL:2", "HSL:10a", "HSL:10b", "HSL:94k", "HSL:550"])
  })

  it("caches per stopId so repeated GETs hit the upstream only once", async () => {
    const client = fakeClient(() => ({
      stop: {
        routes: [{ gtfsId: "HSL:550", shortName: "550", mode: "BUS" }],
      },
    }))
    running = await startTestServer((router) => registerStopLinesRoutes(router, { digitransitClient: client }))

    const r1 = await fetch(`${running.url}/api/stops/HSL:1234/lines`)
    const b1 = (await r1.json()) as StopLinesApiResponse
    const r2 = await fetch(`${running.url}/api/stops/HSL:1234/lines`)
    const b2 = (await r2.json()) as StopLinesApiResponse

    expect(client.calls).toHaveLength(1)
    expect(b1).toEqual(b2)
  })

  it("does not share cache across distinct stop ids", async () => {
    const client = fakeClient((_query, variables) => {
      const stopId = variables?.stopId as string
      return {
        stop: {
          routes: [{ gtfsId: `HSL:${stopId}-line`, shortName: "X", mode: "BUS" }],
        },
      }
    })
    running = await startTestServer((router) => registerStopLinesRoutes(router, { digitransitClient: client }))

    await fetch(`${running.url}/api/stops/HSL:1234/lines`)
    await fetch(`${running.url}/api/stops/HSL:5678/lines`)

    expect(client.calls).toHaveLength(2)
    expect(client.calls[0].variables).toEqual({ stopId: "HSL:1234" })
    expect(client.calls[1].variables).toEqual({ stopId: "HSL:5678" })
  })

  it("returns 502 when the client throws DigitransitUpstreamError", async () => {
    const client = fakeClient(() => {
      throw new DigitransitUpstreamError("upstream went bad", { upstreamStatus: 500 })
    })
    running = await startTestServer((router) => registerStopLinesRoutes(router, { digitransitClient: client }))

    const response = await fetch(`${running.url}/api/stops/HSL:1234/lines`)
    expect(response.status).toBe(502)
    const body = (await response.json()) as { success: false; error: string }
    expect(body).toEqual({ success: false, error: "Upstream Digitransit error" })
  })

  it("returns 400 when the stopId is empty after URL decoding and does not call the client", async () => {
    const client = fakeClient(() => ({ stop: { routes: [] } }))
    running = await startTestServer((router) => registerStopLinesRoutes(router, { digitransitClient: client }))

    const response = await fetch(`${running.url}/api/stops/%20/lines`)
    expect(response.status).toBe(400)
    const body = (await response.json()) as { success: false; error: string }
    expect(body).toEqual({ success: false, error: "Invalid stop id" })
    expect(client.calls).toHaveLength(0)
  })
})
