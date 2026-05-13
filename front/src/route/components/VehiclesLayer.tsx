import { use, useEffect, useRef } from "react"
import { Feature } from "ol"
import { Point } from "ol/geom"
import VectorLayer from "ol/layer/Vector"
import VectorSource from "ol/source/Vector"
import { fromLonLat } from "ol/proj"
import { Fill, Stroke, Style, Text } from "ol/style"
import RegularShape from "ol/style/RegularShape"
import type { ApiVehicle } from "@reitit/back/src/api"
import { MapContext } from "../../map/MapContext"
import { RouteContext } from "../RouteContext"
import { useVehiclesQuery } from "../api"

// Module-scoped style cache keyed by lineShortName.
// In practice line counts are tiny (<100) so we don't bother evicting entries.
const styleCacheByLine = new Map<string, Style>()

function getVehicleStyle(lineShortName: string): Style {
  const existing = styleCacheByLine.get(lineShortName)
  if (existing) return existing
  const style = new Style({
    image: new RegularShape({
      points: 4,
      // radius1/radius2 produce a 14 px wide / 12 px tall rounded square
      // (rotated 45° square would be a diamond; we want axis-aligned).
      radius: 8,
      radius2: 7,
      angle: Math.PI / 4,
      fill: new Fill({ color: "#dc2626" }),
      stroke: new Stroke({ color: "#ffffff", width: 1 }),
    }),
    text: new Text({
      text: lineShortName,
      font: "bold 9px sans-serif",
      fill: new Fill({ color: "#ffffff" }),
      textAlign: "center",
      textBaseline: "middle",
    }),
  })
  styleCacheByLine.set(lineShortName, style)
  return style
}

export const VehiclesLayer = () => {
  const { map } = use(MapContext)
  const { selectedRoute } = use(RouteContext)
  const vehiclesQuery = useVehiclesQuery(selectedRoute.id)
  const data = vehiclesQuery.data

  const layerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const sourceRef = useRef<VectorSource | null>(null)

  // Build layer once on mount; tear down on unmount.
  useEffect(() => {
    const source = new VectorSource()
    const layer = new VectorLayer({
      source,
      updateWhileInteracting: true,
      updateWhileAnimating: true,
    })
    sourceRef.current = source
    layerRef.current = layer
    map.addLayer(layer)
    return () => {
      map.removeLayer(layer)
      sourceRef.current = null
      layerRef.current = null
    }
  }, [map])

  // Diff features by vehicle id whenever poll data changes.
  useEffect(() => {
    const source = sourceRef.current
    if (!source) return
    const vehicles: ApiVehicle[] = data?.vehicles ?? []
    const seen = new Set<string>()

    for (const vehicle of vehicles) {
      seen.add(vehicle.id)
      const coords = fromLonLat([vehicle.lon, vehicle.lat])
      const existing = source.getFeatureById(vehicle.id)
      if (existing) {
        const geometry = existing.getGeometry()
        if (geometry instanceof Point) {
          geometry.setCoordinates(coords)
        }
        existing.set("vehicle", vehicle)
        existing.setStyle(getVehicleStyle(vehicle.lineShortName))
      } else {
        const feature = new Feature({ geometry: new Point(coords) })
        feature.setId(vehicle.id)
        feature.set("vehicle", vehicle)
        feature.setStyle(getVehicleStyle(vehicle.lineShortName))
        source.addFeature(feature)
      }
    }

    for (const feature of source.getFeatures()) {
      const id = feature.getId()
      if (typeof id === "string" && !seen.has(id)) {
        source.removeFeature(feature)
      }
    }
  }, [data])

  return null
}
