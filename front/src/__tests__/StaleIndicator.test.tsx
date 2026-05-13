import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import type { ApiRoute } from "@reitit/back/src/api"
import { RouteContext } from "../route/RouteContext"
import { StaleIndicator } from "../route/components/StaleIndicator"
import { useDeparturesQuery, useVehiclesQuery } from "../route/api"

vi.mock("../route/api", () => ({
  useDeparturesQuery: vi.fn(),
  useVehiclesQuery: vi.fn(),
}))

interface QueryShape {
  data: unknown
  isError: boolean
  failureCount: number
}

function setDepartures(value: QueryShape) {
  vi.mocked(useDeparturesQuery).mockReturnValue(
    value as unknown as ReturnType<typeof useDeparturesQuery>,
  )
}

function setVehicles(value: QueryShape) {
  vi.mocked(useVehiclesQuery).mockReturnValue(
    value as unknown as ReturnType<typeof useVehiclesQuery>,
  )
}

const fakeRoute: ApiRoute = {
  id: 1,
  name: "Test route",
  origin: null,
  destination: null,
  curatedStops: [],
}

function renderIndicator() {
  return render(
    <RouteContext value={{ selectedRoute: fakeRoute }}>
      <StaleIndicator />
    </RouteContext>,
  )
}

describe("StaleIndicator", () => {
  beforeEach(() => {
    vi.mocked(useDeparturesQuery).mockReset()
    vi.mocked(useVehiclesQuery).mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("is hidden when both queries are loading", () => {
    setDepartures({ data: undefined, isError: false, failureCount: 0 })
    setVehicles({ data: undefined, isError: false, failureCount: 0 })

    renderIndicator()

    expect(screen.queryByText("Stale")).not.toBeInTheDocument()
  })

  it("is hidden when a query has isError=true but failureCount=1", () => {
    setDepartures({ data: undefined, isError: true, failureCount: 1 })
    setVehicles({ data: undefined, isError: false, failureCount: 0 })

    renderIndicator()

    expect(screen.queryByText("Stale")).not.toBeInTheDocument()
  })

  it("is visible when departures has failureCount=2 and isError=true", () => {
    setDepartures({ data: undefined, isError: true, failureCount: 2 })
    setVehicles({ data: undefined, isError: false, failureCount: 0 })

    renderIndicator()

    expect(screen.getByText("Stale")).toBeInTheDocument()
  })

  it("is visible when vehicles has failureCount=2 and isError=true", () => {
    setDepartures({ data: undefined, isError: false, failureCount: 0 })
    setVehicles({ data: undefined, isError: true, failureCount: 2 })

    renderIndicator()

    expect(screen.getByText("Stale")).toBeInTheDocument()
  })

  it("is hidden after a success (isError=false, failureCount=0)", () => {
    setDepartures({ data: { departures: [] }, isError: false, failureCount: 0 })
    setVehicles({ data: { vehicles: [] }, isError: false, failureCount: 0 })

    renderIndicator()

    expect(screen.queryByText("Stale")).not.toBeInTheDocument()
  })
})
