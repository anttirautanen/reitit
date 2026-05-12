import { use, useEffect } from "react"
import { createRoot, type Root } from "react-dom/client"
import Overlay from "ol/Overlay"
import { fromLonLat } from "ol/proj"
import { MapContext } from "../../map/MapContext"
import { StopCard } from "./StopCard"
import { useCuratedStopsResolved } from "./useCuratedStopsResolved"

export const StopCardsLayer = () => {
  const { map } = use(MapContext)
  const { key, entries: resolvedEntries } = useCuratedStopsResolved()

  useEffect(() => {
    const entries: { overlay: Overlay; root: Root; element: HTMLDivElement }[] = []

    for (const { curatedStop, stop } of resolvedEntries) {
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
        // Wrap in try/catch because React 19 strict-effects runs cleanup twice in dev;
        // the second unmount on the same root would otherwise log a warning.
        queueMicrotask(() => {
          try {
            root.unmount()
          } catch {
            // already unmounted by a previous cleanup pass — ignore
          }
        })
      }
    }
  }, [map, key, resolvedEntries])

  return null
}
