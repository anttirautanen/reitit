import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render } from "@testing-library/react"
import { Feature, Map, View } from "ol"
import VectorLayer from "ol/layer/Vector"
import VectorSource from "ol/source/Vector"
import type { ApiCuratedStop, ApiRoute, ApiStop } from "@reitit/back/src/api"
import { MapContext } from "../map/MapContext"
import { StopsContext } from "../stops/StopsContext"
import { RouteContext } from "../route/RouteContext"
import { AddStopMode } from "../route/components/AddStopMode"

interface HarnessOptions {
  map: Map
  stops: ApiStop[]
  curatedStops: ApiCuratedStop[]
  onPickStop: (stopId: string) => void
}

function renderHarness({ map, stops, curatedStops, onPickStop }: HarnessOptions) {
  const route: ApiRoute = {
    id: 1,
    name: "Test route",
    origin: null,
    destination: null,
    curatedStops,
  }
  return render(
    <MapContext value={{ map }}>
      <StopsContext value={{ stops }}>
        <RouteContext value={{ selectedRoute: route }}>
          <AddStopMode onPickStop={onPickStop} />
        </RouteContext>
      </StopsContext>
    </MapContext>,
  )
}

function createMap(): Map {
  return new Map({ view: new View({ center: [0, 0], zoom: 0 }) })
}

function findAddStopLayer(map: Map): VectorLayer<VectorSource> | undefined {
  const layers = map.getLayers().getArray()
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i]
    if (!(layer instanceof VectorLayer)) continue
    const source: unknown = layer.getSource()
    if (!(source instanceof VectorSource)) continue
    const features = source.getFeatures() as Feature[]
    if (features.length === 0) continue
    if (features.some((f) => f.get("stop") !== undefined)) {
      return layer as VectorLayer<VectorSource>
    }
  }
  return undefined
}

const stopA: ApiStop = { gtfsId: "HSL:1", name: "Alpha", lat: 60.17, lon: 24.93 }
const stopB: ApiStop = { gtfsId: "HSL:2", name: "Bravo", lat: 60.18, lon: 24.94 }
const stopC: ApiStop = { gtfsId: "HSL:3", name: "Charlie", lat: 60.19, lon: 24.95 }

describe("AddStopMode", () => {
  afterEach(() => {
    cleanup()
  })

  it("mounts a vector layer with one feature per non-curated stop", () => {
    const map = createMap()
    renderHarness({
      map,
      stops: [stopA, stopB, stopC],
      curatedStops: [{ stopId: "HSL:2", lines: ["L1"] }],
      onPickStop: vi.fn(),
    })

    const layer = findAddStopLayer(map)
    if (!layer) throw new Error("expected add-stop layer")
    const source = layer.getSource()
    if (!source) throw new Error("expected vector source")
    const ids = source.getFeatures().map((f) => f.getId()).sort()
    expect(ids).toEqual(["HSL:1", "HSL:3"])
  })

  it("invokes onPickStop with the right gtfsId when a feature is clicked", () => {
    const map = createMap()
    const onPickStop = vi.fn<(stopId: string) => void>()
    renderHarness({
      map,
      stops: [stopA, stopB],
      curatedStops: [],
      onPickStop,
    })

    const layer = findAddStopLayer(map)
    if (!layer) throw new Error("expected add-stop layer")

    // Stub forEachFeatureAtPixel to invoke the callback with our chosen feature,
    // because jsdom has no canvas/pixel mapping.
    const source = layer.getSource()
    if (!source) throw new Error("expected vector source")
    const target = source.getFeatureById("HSL:2")
    if (!target) throw new Error("expected stop B feature")

    const spy = vi
      .spyOn(map, "forEachFeatureAtPixel")
      .mockImplementation((_pixel, callback) => {
        callback(target, layer, target.getGeometry() ?? null)
        return undefined
      })

    map.dispatchEvent({ type: "singleclick", pixel: [10, 10] } as never)

    expect(onPickStop).toHaveBeenCalledTimes(1)
    expect(onPickStop).toHaveBeenCalledWith("HSL:2")

    spy.mockRestore()
  })

  it("removes the layer and the click listener on unmount", () => {
    const map = createMap()
    const onPickStop = vi.fn<(stopId: string) => void>()
    const { unmount } = renderHarness({
      map,
      stops: [stopA],
      curatedStops: [],
      onPickStop,
    })

    const layer = findAddStopLayer(map)
    if (!layer) throw new Error("expected add-stop layer")

    unmount()

    expect(map.getLayers().getArray().includes(layer)).toBe(false)

    // After unmount, dispatching singleclick should not invoke onPickStop.
    const forEachSpy = vi
      .spyOn(map, "forEachFeatureAtPixel")
      .mockImplementation((_pixel, callback) => {
        // Even if a feature is somehow reported, the listener must be detached
        // so the callback never gets a chance to invoke onPickStop.
        const fake = new Feature()
        fake.setId("HSL:1")
        callback(fake, null as never, null)
        return undefined
      })

    map.dispatchEvent({ type: "singleclick", pixel: [10, 10] } as never)

    expect(onPickStop).not.toHaveBeenCalled()
    forEachSpy.mockRestore()
  })
})
