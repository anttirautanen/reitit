import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render } from "@testing-library/react"
import { Map, View } from "ol"
import type { ApiCuratedStop, ApiRoute, ApiStop } from "@reitit/back/src/api"
import { MapContext } from "../map/MapContext"
import { StopsContext } from "../stops/StopsContext"
import { RouteContext } from "../route/RouteContext"
import { useMapFitToCurated } from "../route/components/useMapFitToCurated"

interface HarnessOptions {
  map: Map
  stops: ApiStop[]
  selectedRoute: ApiRoute
}

const HookProbe = () => {
  useMapFitToCurated()
  return null
}

function renderHarness({ map, stops, selectedRoute }: HarnessOptions) {
  return render(
    <MapContext value={{ map }}>
      <StopsContext value={{ stops }}>
        <RouteContext value={{ selectedRoute }}>
          <HookProbe />
        </RouteContext>
      </StopsContext>
    </MapContext>,
  )
}

function createMap(): Map {
  return new Map({
    view: new View({ center: [0, 0], zoom: 0 }),
  })
}

const stopA: ApiStop = { gtfsId: "HSL:1", name: "Alpha", lat: 60.17, lon: 24.93 }
const stopB: ApiStop = { gtfsId: "HSL:2", name: "Bravo", lat: 60.18, lon: 24.94 }

function makeRoute(curatedStops: ApiCuratedStop[]): ApiRoute {
  return {
    id: 42,
    name: "Test route",
    origin: null,
    destination: null,
    curatedStops,
  }
}

describe("useMapFitToCurated", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("fits the view to curated stops with the configured padding", () => {
    const map = createMap()
    const fitSpy = vi.spyOn(map.getView(), "fit")
    const stops = [stopA, stopB]
    const curatedStops: ApiCuratedStop[] = [
      { stopId: "HSL:1", lines: ["1001"] },
      { stopId: "HSL:2", lines: ["1002"] },
    ]
    renderHarness({ map, stops, selectedRoute: makeRoute(curatedStops) })

    expect(fitSpy).toHaveBeenCalledTimes(1)
    const [, options] = fitSpy.mock.calls[0]
    expect(options?.padding).toEqual([120, 40, 40, 40])
  })

  it("does not fit when there are no curated stops", () => {
    const map = createMap()
    const fitSpy = vi.spyOn(map.getView(), "fit")
    renderHarness({ map, stops: [stopA, stopB], selectedRoute: makeRoute([]) })

    expect(fitSpy).not.toHaveBeenCalled()
  })
})
