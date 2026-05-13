import { use, useEffect, useRef } from "react"
import { createRoot, type Root } from "react-dom/client"
import Overlay from "ol/Overlay"
import { fromLonLat } from "ol/proj"
import { MapContext } from "../../map/MapContext"
import { RouteContext } from "../RouteContext"
import { useDeparturesQuery } from "../api"
import { StopCard, type StopCardLine } from "./StopCard"
import { useCuratedStopsResolved } from "./useCuratedStopsResolved"

interface OverlayEntry {
  overlay: Overlay
  root: Root
  element: HTMLDivElement
}

interface StopCardsLayerProps {
  onCardClick?: (stopId: string) => void
  onCardRemove?: (stopId: string) => void
}

export const StopCardsLayer = ({ onCardClick, onCardRemove }: StopCardsLayerProps = {}) => {
  const { map } = use(MapContext)
  const { selectedRoute } = use(RouteContext)
  const { key, entries: resolvedEntries } = useCuratedStopsResolved()
  const departuresQuery = useDeparturesQuery(selectedRoute.id)
  const departuresData = departuresQuery.data

  // Roots keyed by stopId so we can re-render with fresh departures without rebuilding overlays.
  const overlaysByStopId = useRef<Map<string, OverlayEntry>>(new Map())

  // Stable handler ref: lets us swap callbacks without tearing down overlays.
  const onCardClickRef = useRef(onCardClick)
  useEffect(() => {
    onCardClickRef.current = onCardClick
  }, [onCardClick])
  const onCardRemoveRef = useRef(onCardRemove)
  useEffect(() => {
    onCardRemoveRef.current = onCardRemove
  }, [onCardRemove])

  // Rebuild overlays whenever the curated set changes (key changes).
  useEffect(() => {
    const created = new Map<string, OverlayEntry>()

    for (const { curatedStop, stop } of resolvedEntries) {
      const element = document.createElement("div")
      const root = createRoot(element)
      const overlay = new Overlay({
        element,
        position: fromLonLat([stop.lon, stop.lat]),
        positioning: "bottom-left",
        offset: [10, -8],
        stopEvent: false,
      })
      map.addOverlay(overlay)
      created.set(curatedStop.stopId, { overlay, root, element })
    }

    overlaysByStopId.current = created

    return () => {
      for (const { overlay, root } of created.values()) {
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

  // Render / re-render each overlay's React root whenever curated set or departures data changes.
  useEffect(() => {
    const stopsById = new Map(departuresData?.stops.map((s) => [s.stopId, s]) ?? [])
    for (const { curatedStop, stop } of resolvedEntries) {
      const entry = overlaysByStopId.current.get(curatedStop.stopId)
      if (!entry) continue
      const stopDepartures = stopsById.get(curatedStop.stopId)
      const lines: StopCardLine[] = curatedStop.lines.map((lineGtfsId) => {
        const match = stopDepartures?.lines.find((l) => l.gtfsId === lineGtfsId)
        if (match) {
          return {
            gtfsId: match.gtfsId,
            shortName: match.shortName,
            departures: match.departures,
          }
        }
        return { gtfsId: lineGtfsId, shortName: null, departures: [] }
      })
      const stopId = curatedStop.stopId
      entry.root.render(
        <StopCard
          stopName={stop.name}
          lines={lines}
          onClick={() => onCardClickRef.current?.(stopId)}
          onRemove={() => onCardRemoveRef.current?.(stopId)}
        />,
      )
    }
  }, [key, resolvedEntries, departuresData])

  return null
}
