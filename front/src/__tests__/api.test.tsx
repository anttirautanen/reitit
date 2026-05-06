import { afterEach, describe, expect, it, vi } from "vitest"
import { type PropsWithChildren } from "react"
import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  useAddOrUpdateCuratedStop,
  useDeleteCuratedStop,
  useDeparturesQuery,
  useRouteWithStops,
  useRoutesQuery,
  useStopLinesQuery,
  useVehiclesQuery,
} from "../route/api"

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
}

function makeWrapper(client: QueryClient) {
  return ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("useRoutesQuery", () => {
  it("calls /api/routes and returns the parsed body", async () => {
    const body = { routes: [{ id: 1, name: "R", origin: null, destination: null, curatedStops: [] }] }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body))
    vi.stubGlobal("fetch", fetchMock)

    const client = createClient()
    const { result } = renderHook(() => useRoutesQuery(), { wrapper: makeWrapper(client) })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/api/routes", undefined)
    expect(result.current.data).toEqual(body)
  })
})

describe("useStopLinesQuery", () => {
  it("is disabled when stopId is null", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const client = createClient()
    const { result } = renderHook(() => useStopLinesQuery(null), { wrapper: makeWrapper(client) })

    // The query should not be enabled — give the microtask queue a chance to flush.
    await Promise.resolve()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.fetchStatus).toBe("idle")
  })

  it("fetches /api/stops/:stopId/lines when stopId is provided and URL-encodes the stopId", async () => {
    const body = { lines: [{ gtfsId: "HSL:123", shortName: "1", mode: "BUS" }] }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body))
    vi.stubGlobal("fetch", fetchMock)

    const client = createClient()
    const { result } = renderHook(() => useStopLinesQuery("HSL:1234"), { wrapper: makeWrapper(client) })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(fetchMock).toHaveBeenCalledWith("/api/stops/HSL%3A1234/lines", undefined)
    expect(result.current.data).toEqual(body)
  })
})

describe("useRouteWithStops", () => {
  it("returns notFound=false and undefined route when routeId is null", () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const client = createClient()
    const { result } = renderHook(() => useRouteWithStops(null), { wrapper: makeWrapper(client) })

    // No fetch should fire because the underlying useRoutesQuery is still gated by mount,
    // but useRouteWithStops itself should immediately return the null-routeId shape.
    expect(result.current).toEqual({
      route: undefined,
      isLoading: false,
      isError: false,
      notFound: false,
    })
  })

  it("returns the matching route when routes have loaded and the id exists", async () => {
    const route = { id: 7, name: "R7", origin: null, destination: null, curatedStops: [] }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ routes: [route] }))
    vi.stubGlobal("fetch", fetchMock)

    const client = createClient()
    const { result } = renderHook(() => useRouteWithStops(7), { wrapper: makeWrapper(client) })

    await waitFor(() => {
      expect(result.current.route).toBeDefined()
    })

    expect(result.current).toEqual({
      route,
      isLoading: false,
      isError: false,
      notFound: false,
    })
  })

  it("returns notFound=true when routes have loaded but the id is missing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ routes: [] }))
    vi.stubGlobal("fetch", fetchMock)

    const client = createClient()
    const { result } = renderHook(() => useRouteWithStops(42), { wrapper: makeWrapper(client) })

    await waitFor(() => {
      expect(result.current.notFound).toBe(true)
    })

    expect(result.current).toEqual({
      route: undefined,
      isLoading: false,
      isError: false,
      notFound: true,
    })
  })
})

describe("useDeparturesQuery refetchInterval", () => {
  it("is configured with refetchInterval of 30 seconds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ stops: [] }))
    vi.stubGlobal("fetch", fetchMock)

    const client = createClient()
    const { result } = renderHook(() => useDeparturesQuery(1), { wrapper: makeWrapper(client) })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    const cached = client.getQueryCache().find({ queryKey: ["departures", 1] })
    expect(cached?.options.refetchInterval).toBe(30_000)
  })
})

describe("useVehiclesQuery refetchInterval", () => {
  it("is configured with refetchInterval of 5 seconds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ vehicles: [] }))
    vi.stubGlobal("fetch", fetchMock)

    const client = createClient()
    const { result } = renderHook(() => useVehiclesQuery(1), { wrapper: makeWrapper(client) })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    const cached = client.getQueryCache().find({ queryKey: ["vehicles", 1] })
    expect(cached?.options.refetchInterval).toBe(5_000)
  })
})

describe("useAddOrUpdateCuratedStop", () => {
  it("POSTs the right body and invalidates routes/departures/vehicles for the route", async () => {
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    const client = createClient()
    const invalidateSpy = vi.spyOn(client, "invalidateQueries")

    const { result } = renderHook(() => useAddOrUpdateCuratedStop(), { wrapper: makeWrapper(client) })

    await act(async () => {
      await result.current.mutateAsync({ routeId: 1, stopId: "HSL:1", lines: ["HSL:550"] })
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toBe("/api/routes/1/stops")
    expect(init?.method).toBe("POST")
    expect(JSON.parse(init?.body as string)).toEqual({ stopId: "HSL:1", lines: ["HSL:550"] })

    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey)
    expect(invalidatedKeys).toEqual(expect.arrayContaining([["routes"], ["departures", 1], ["vehicles", 1]]))
  })
})

describe("useDeleteCuratedStop", () => {
  it("DELETEs and invalidates routes/departures/vehicles for the route", async () => {
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    const client = createClient()
    const invalidateSpy = vi.spyOn(client, "invalidateQueries")

    const { result } = renderHook(() => useDeleteCuratedStop(), { wrapper: makeWrapper(client) })

    await act(async () => {
      await result.current.mutateAsync({ routeId: 1, stopId: "HSL:1" })
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toBe("/api/routes/1/stops/HSL%3A1")
    expect(init?.method).toBe("DELETE")

    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey)
    expect(invalidatedKeys).toEqual(expect.arrayContaining([["routes"], ["departures", 1], ["vehicles", 1]]))
  })
})

describe("apiFetch error handling", () => {
  it("surfaces the body's `error` field on a non-2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "stop_not_found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const client = createClient()
    const { result } = renderHook(() => useRoutesQuery(), { wrapper: makeWrapper(client) })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    const error = result.current.error
    expect(error).toBeInstanceOf(Error)
    expect(error?.message).toMatch(/404/)
    expect(error?.message).toMatch(/stop_not_found/)
  })
})
