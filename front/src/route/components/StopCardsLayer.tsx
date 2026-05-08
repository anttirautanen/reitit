import { use, useEffect, useMemo } from "react"
import { createRoot, type Root } from "react-dom/client"
import Overlay from "ol/Overlay"
import { fromLonLat } from "ol/proj"
import { MapContext } from "../../map/MapContext"
import { StopsContext } from "../../stops/StopsContext"
import { RouteContext } from "../RouteContext"
import { StopCard } from "./StopCard"

export const StopCardsLayer = () => {
  const { map } = use(MapContext)
  const { stops } = use(StopsContext)
  const { selectedRoute } = use(RouteContext)
  const { curatedStops } = selectedRoute

  const curatedKey = useMemo(
    () => curatedStops.map((cs) => `${cs.stopId}:${cs.lines.join(",")}`).join("|"),
    [curatedStops],
  )

  useEffect(() => {
    const stopsById = new Map<string, (typeof stops)[number]>()
    for (const stop of stops) {
      stopsById.set(stop.gtfsId, stop)
    }

    const entries: { overlay: Overlay; root: Root; element: HTMLDivElement }[] = []

    for (const curatedStop of curatedStops) {
      const stop = stopsById.get(curatedStop.stopId)
      if (!stop) continue

      const element = document.createElement("div")
      const root = createRoot(element)
      root.render(<StopCard stopName={stop.name} lines={curatedStop.lines} />)

      const overlay = new Overlay({
        element,
        position: fromLonLat([stop.lon, stop.lat]),
        positioning: "bottom-left",
        offset: [10, -8],
        stopEvent: false,
      })

      map.addOverlay(overlay)
      entries.push({ overlay, root, element })
    }

    return () => {
      for (const { overlay, root } of entries) {
        map.removeOverlay(overlay)
        // Defer unmount so React can finish any in-flight commit before tearing down.
        queueMicrotask(() => root.unmount())
      }
    }
    // curatedStops is intentionally excluded; curatedKey is its structural digest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, stops, curatedKey])

  return null
}
