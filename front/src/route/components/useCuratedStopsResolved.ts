import { use, useMemo } from "react"
import type { ApiCuratedStop, ApiStop } from "@reitit/back/src/api"
import { RouteContext } from "../RouteContext"
import { StopsContext } from "../../stops/StopsContext"

export interface ResolvedCuratedStop {
  curatedStop: ApiCuratedStop
  stop: ApiStop
}

export function useCuratedStopsResolved(): { key: string; entries: ResolvedCuratedStop[] } {
  const { selectedRoute } = use(RouteContext)
  const { stops } = use(StopsContext)
  const curatedStops = selectedRoute.curatedStops

  const stopsById = useMemo(() => {
    const map = new Map<string, ApiStop>()
    for (const s of stops) map.set(s.gtfsId, s)
    return map
  }, [stops])

  const entries = useMemo<ResolvedCuratedStop[]>(() => {
    const out: ResolvedCuratedStop[] = []
    for (const cs of curatedStops) {
      const s = stopsById.get(cs.stopId)
      if (!s) continue
      out.push({ curatedStop: cs, stop: s })
    }
    return out
  }, [curatedStops, stopsById])

  const key = useMemo(
    () =>
      entries
        .map(
          (e) =>
            `${e.curatedStop.stopId}:${e.curatedStop.lines.join(",")}:${String(e.stop.lat)},${String(e.stop.lon)}`,
        )
        .join("|"),
    [entries],
  )

  return { key, entries }
}
