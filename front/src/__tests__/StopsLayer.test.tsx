import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { cleanup, render } from "@testing-library/react"
import { Feature, Map, View } from "ol"
import VectorLayer from "ol/layer/Vector"
import VectorSource from "ol/source/Vector"
import type { ApiCuratedStop, ApiRoute, ApiStop } from "@reitit/back/src/api"
import { MapContext } from "../map/MapContext"
import { StopsContext } from "../stops/StopsContext"
import { RouteContext } from "../route/RouteContext"
import { StopsLayer } from "../route/components/StopsLayer"

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe() {
        /* no-op for jsdom */
      }
      unobserve() {
        /* no-op for jsdom */
      }
      disconnect() {
        /* no-op for jsdom */
      }
    }
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
  }
})

interface HarnessOptions {
  map: Map
  stops: ApiStop[]
  selectedRoute: ApiRoute
}

function renderHarness({ map, stops, selectedRoute }: HarnessOptions) {
  return render(
    <MapContext value={{ map }}>
      <StopsContext value={{ stops }}>
        <RouteContext value={{ selectedRoute }}>
          <StopsLayer />
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

function findStopsLayer(map: Map): VectorLayer<VectorSource> | undefined {
  for (const layer of map.getLayers().getArray()) {
    if (!(layer instanceof VectorLayer)) continue
    const source: unknown = layer.getSource()
    if (!(source instanceof VectorSource)) continue
    const features = source.getFeatures() as Feature[]
    const hasStopFeatures = features.some((feature) => feature.get("stop") !== undefined)
    if (hasStopFeatures) return layer as VectorLayer<VectorSource>
  }
  return undefined
}

const stopA: ApiStop = { gtfsId: "HSL:1", name: "Alpha", lat: 60.17, lon: 24.93 }
const stopB: ApiStop = { gtfsId: "HSL:2", name: "Bravo", lat: 60.18, lon: 24.94 }
const stopC: ApiStop = { gtfsId: "HSL:3", name: "Charlie", lat: 60.19, lon: 24.95 }

function makeRoute(curatedStops: ApiCuratedStop[]): ApiRoute {
  return {
    id: 42,
    name: "Test route",
    origin: null,
    destination: null,
    curatedStops,
  }
}

describe("StopsLayer", () => {
  afterEach(() => {
    cleanup()
  })

  it("builds one feature per curated stop", () => {
    const map = createMap()
    const stops = [stopA, stopB, stopC]
    const curatedStops: ApiCuratedStop[] = [
      { stopId: "HSL:1", lines: ["1001"] },
      { stopId: "HSL:3", lines: ["1003"] },
    ]
    renderHarness({ map, stops, selectedRoute: makeRoute(curatedStops) })

    const layer = findStopsLayer(map)
    if (!layer) throw new Error("expected stops layer")
    const source = layer.getSource()
    if (!source) throw new Error("expected vector source")
    const features = source.getFeatures()
    expect(features).toHaveLength(2)

    const featureStopIds = features.map((f) => (f.get("stop") as ApiStop).gtfsId).sort()
    expect(featureStopIds).toEqual(["HSL:1", "HSL:3"])

    const featureCuratedIds = features
      .map((f) => (f.get("curatedStop") as ApiCuratedStop).stopId)
      .sort()
    expect(featureCuratedIds).toEqual(["HSL:1", "HSL:3"])
  })

  it("skips curated stops missing from the all-stops list", () => {
    const map = createMap()
    const stops = [stopA]
    const curatedStops: ApiCuratedStop[] = [
      { stopId: "HSL:1", lines: ["1001"] },
      { stopId: "HSL:missing", lines: ["1002"] },
    ]
    renderHarness({ map, stops, selectedRoute: makeRoute(curatedStops) })

    const layer = findStopsLayer(map)
    if (!layer) throw new Error("expected stops layer")
    const source = layer.getSource()
    if (!source) throw new Error("expected vector source")
    const features = source.getFeatures()
    expect(features).toHaveLength(1)
    expect((features[0].get("stop") as ApiStop).gtfsId).toBe("HSL:1")
  })

  it("removes the layer on unmount", () => {
    const map = createMap()
    const stops = [stopA]
    const curatedStops: ApiCuratedStop[] = [{ stopId: "HSL:1", lines: ["1001"] }]
    const { unmount } = renderHarness({ map, stops, selectedRoute: makeRoute(curatedStops) })

    expect(findStopsLayer(map)).toBeDefined()

    unmount()

    expect(findStopsLayer(map)).toBeUndefined()
  })
})
