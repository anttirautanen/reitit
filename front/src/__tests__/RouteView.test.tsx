import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ApiRoute } from "@reitit/back/src/api"
import { RouteContext } from "../route/RouteContext"
import { RouteView } from "../route/RouteView"

vi.mock("../map/MapView", () => ({
  MapView: () => <div data-testid="map-view-stub" />,
}))

interface RenderOptions {
  selectedRoute: ApiRoute
  onAddStop?: () => void
}

function renderWithProviders({ selectedRoute, onAddStop }: RenderOptions) {
  return render(
    <RouteContext value={{ selectedRoute }}>
      <RouteView onAddStop={onAddStop} />
    </RouteContext>,
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
