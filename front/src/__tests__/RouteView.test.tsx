import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ApiRoute } from "@reitit/back/src/api"
import { RouteContext } from "../route/RouteContext"
import { RouteView } from "../route/RouteView"
import { StopsContext } from "../stops/StopsContext"

vi.mock("../map/MapView", () => ({
  MapView: () => <div data-testid="map-view-stub" />,
}))

vi.mock("../route/components/StopsLayer", () => ({
  StopsLayer: () => null,
}))

vi.mock("../route/components/StopCardsLayer", () => ({
  StopCardsLayer: () => null,
}))

vi.mock("../route/components/VehiclesLayer", () => ({
  VehiclesLayer: () => null,
}))

vi.mock("../route/components/StaleIndicator", () => ({
  StaleIndicator: () => null,
}))

vi.mock("../route/components/EmptyState", () => ({
  EmptyState: () => null,
}))

vi.mock("../route/components/AddStopMode", () => ({
  AddStopMode: () => null,
}))

vi.mock("../route/components/useMapFitToCurated", () => ({
  useMapFitToCurated: () => undefined,
}))

vi.mock("../route/api", () => ({
  useUpdateCuratedLines: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    error: null,
  }),
  useDeleteCuratedStop: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    error: null,
  }),
  useAddOrUpdateCuratedStop: () => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    error: null,
  }),
}))

interface RenderOptions {
  selectedRoute: ApiRoute
  onAddStop?: () => void
}

function renderWithProviders({ selectedRoute, onAddStop }: RenderOptions) {
  return render(
    <StopsContext value={{ stops: [] }}>
      <RouteContext value={{ selectedRoute }}>
        <RouteView onAddStop={onAddStop} />
      </RouteContext>
    </StopsContext>,
  )
}

const fakeRoute: ApiRoute = {
  id: 1,
  name: "Home → Work",
  origin: null,
  destination: null,
  curatedStops: [],
}

describe("RouteView", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the route name in the top bar", () => {
    renderWithProviders({ selectedRoute: fakeRoute })
    expect(screen.getByRole("heading", { name: "Home → Work" })).toBeInTheDocument()
  })

  it("renders an Add stop button", () => {
    renderWithProviders({ selectedRoute: fakeRoute })
    expect(screen.getByRole("button", { name: /add stop/i })).toBeInTheDocument()
  })

  it("invokes onAddStop when the Add stop button is clicked", () => {
    const onAddStop = vi.fn()
    renderWithProviders({ selectedRoute: fakeRoute, onAddStop })

    fireEvent.click(screen.getByRole("button", { name: /add stop/i }))

    expect(onAddStop).toHaveBeenCalledTimes(1)
  })

  it("renders the stub MapView", () => {
    renderWithProviders({ selectedRoute: fakeRoute })
    expect(screen.getByTestId("map-view-stub")).toBeInTheDocument()
  })
})
