import { use, useEffect } from "react"
import { MultiPoint } from "ol/geom"
import { fromLonLat } from "ol/proj"
import { MapContext } from "../../map/MapContext"
import { useCuratedStopsResolved } from "./useCuratedStopsResolved"

export function useMapFitToCurated(): void {
  const { map } = use(MapContext)
  const { key, entries } = useCuratedStopsResolved()

  useEffect(() => {
    if (entries.length === 0) return
    const points = entries.map((e) => fromLonLat([e.stop.lon, e.stop.lat]))
    const multiPoint = new MultiPoint(points)
    const extent = multiPoint.getExtent()
    map.getView().fit(extent, { padding: [120, 40, 40, 40], duration: 600 })
  }, [map, key, entries])
}
