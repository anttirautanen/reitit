import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render } from "@testing-library/react"
import { Feature, Map, View } from "ol"
import { Point } from "ol/geom"
import VectorLayer from "ol/layer/Vector"
import VectorSource from "ol/source/Vector"
import { fromLonLat } from "ol/proj"
import type { ApiRoute, ApiVehicle, VehiclesApiResponse } from "@reitit/back/src/api"
import { MapContext } from "../map/MapContext"
import { RouteContext } from "../route/RouteContext"
import { VehiclesLayer } from "../route/components/VehiclesLayer"
import { useVehiclesQuery } from "../route/api"

vi.mock("../route/api", () => ({
  useVehiclesQuery: vi.fn(),
}))

interface QueryShape {
  data: VehiclesApiResponse | undefined
  isLoading: boolean
  isError: boolean
}

function setQuery(value: QueryShape) {
  vi.mocked(useVehiclesQuery).mockReturnValue(value as unknown as ReturnType<typeof useVehiclesQuery>)
}

const fakeRoute: ApiRoute = {
  id: 7,
  name: "Test route",
  origin: null,
  destination: null,
  curatedStops: [],
}

function createMap(): Map {
  return new Map({ view: new View({ center: [0, 0], zoom: 0 }) })
}

function renderHarness(map: Map) {
  return render(
    <MapContext value={{ map }}>
      <RouteContext value={{ selectedRoute: fakeRoute }}>
        <VehiclesLayer />
      </RouteContext>
    </MapContext>,
  )
}

function findVehiclesLayer(map: Map): VectorLayer<VectorSource> | undefined {
  // Pick the most recently added VectorLayer (vehicles layer is added on mount).
  const layers = map.getLayers().getArray()
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i]
    if (layer instanceof VectorLayer) {
      const source: unknown = layer.getSource()
      if (source instanceof VectorSource) {
        return layer as VectorLayer<VectorSource>
      }
    }
  }
  return undefined
}

function vehicle(
  id: string,
  lon: number,
  lat: number,
  lineShortName = "10",
  lineGtfsId = "HSL:1010",
): ApiVehicle {
  return { id, lineGtfsId, lineShortName, lon, lat, bearing: null, speedMs: null }
}

function getCoords(feature: Feature): [number, number] {
  const geometry = feature.getGeometry()
  if (!(geometry instanceof Point)) throw new Error("expected point geometry")
  const coords = geometry.getCoordinates()
  return [coords[0], coords[1]]
}

describe("VehiclesLayer", () => {
  beforeEach(() => {
    vi.mocked(useVehiclesQuery).mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders one feature per vehicle on the first poll", () => {
    const vehicles = [
      vehicle("v1", 24.93, 60.17),
      vehicle("v2", 24.94, 60.18),
      vehicle("v3", 24.95, 60.19, "20"),
    ]
    setQuery({ data: { vehicles }, isLoading: false, isError: false })

    const map = createMap()
    renderHarness(map)

    const layer = findVehiclesLayer(map)
    if (!layer) throw new Error("expected vehicles layer")
    const source = layer.getSource()
    if (!source) throw new Error("expected vector source")
    const features = source.getFeatures()
    expect(features).toHaveLength(3)

    const ids = features.map((f) => f.getId()).sort()
    expect(ids).toEqual(["v1", "v2", "v3"])

    const v1 = source.getFeatureById("v1")
    if (!v1) throw new Error("expected v1 feature")
    expect(getCoords(v1)).toEqual(fromLonLat([24.93, 60.17]))
  })

  it("diffs features across polls (move, remove, add)", () => {
    const initial = [
      vehicle("A", 24.93, 60.17),
      vehicle("B", 24.94, 60.18),
      vehicle("C", 24.95, 60.19),
    ]
    setQuery({ data: { vehicles: initial }, isLoading: false, isError: false })

    const map = createMap()
    const { rerender } = renderHarness(map)

    const layer = findVehiclesLayer(map)
    if (!layer) throw new Error("expected vehicles layer")
    const source = layer.getSource()
    if (!source) throw new Error("expected vector source")
    expect(source.getFeatures()).toHaveLength(3)

    // Second poll: A moved, B moved, C gone, D new.
    const next = [
      vehicle("A", 25.0, 60.2),
      vehicle("B", 25.01, 60.21),
      vehicle("D", 25.02, 60.22, "30"),
    ]
    setQuery({ data: { vehicles: next }, isLoading: false, isError: false })

    rerender(
      <MapContext value={{ map }}>
        <RouteContext value={{ selectedRoute: fakeRoute }}>
          <VehiclesLayer />
        </RouteContext>
      </MapContext>,
    )

    expect(source.getFeatures()).toHaveLength(3)

    const ids = source.getFeatures().map((f) => f.getId()).sort()
    expect(ids).toEqual(["A", "B", "D"])

    const a = source.getFeatureById("A")
    const b = source.getFeatureById("B")
    const d = source.getFeatureById("D")
    if (!a || !b || !d) throw new Error("expected A, B, D")

    expect(getCoords(a)).toEqual(fromLonLat([25.0, 60.2]))
    expect(getCoords(b)).toEqual(fromLonLat([25.01, 60.21]))
    expect(getCoords(d)).toEqual(fromLonLat([25.02, 60.22]))
    expect(source.getFeatureById("C")).toBeNull()
  })

  it("removes the layer on unmount", () => {
    setQuery({ data: { vehicles: [vehicle("v1", 24.93, 60.17)] }, isLoading: false, isError: false })

    const map = createMap()
    const { unmount } = renderHarness(map)

    const layer = findVehiclesLayer(map)
    if (!layer) throw new Error("expected vehicles layer")

    unmount()

    expect(map.getLayers().getArray().includes(layer)).toBe(false)
  })
})
