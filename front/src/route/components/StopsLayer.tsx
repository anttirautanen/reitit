import { use, useEffect, useMemo } from "react"
import { Feature } from "ol"
import { Point } from "ol/geom"
import VectorLayer from "ol/layer/Vector"
import VectorSource from "ol/source/Vector"
import { fromLonLat } from "ol/proj"
import { Fill, Stroke, Style } from "ol/style"
import CircleStyle from "ol/style/Circle"
import { MapContext } from "../../map/MapContext"
import { StopsContext } from "../../stops/StopsContext"
import { RouteContext } from "../RouteContext"

const curatedStopStyle = new Style({
  image: new CircleStyle({
    radius: 6,
    fill: new Fill({ color: "#2563eb" }),
    stroke: new Stroke({ color: "white", width: 2 }),
  }),
})

export const StopsLayer = () => {
  const { map } = use(MapContext)
  const { stops } = use(StopsContext)
  const { selectedRoute } = use(RouteContext)
  const { curatedStops } = selectedRoute

  const curatedKey = useMemo(
    () => curatedStops.map((cs) => `${cs.stopId}:${cs.lines.join(",")}`).join("|"),
    [curatedStops],
  )

  useEffect(() => {
    const source = new VectorSource()
    const layer = new VectorLayer({
      source,
      style: curatedStopStyle,
      updateWhileInteracting: true,
      updateWhileAnimating: true,
    })

    const stopsById = new Map<string, (typeof stops)[number]>()
    for (const stop of stops) {
      stopsById.set(stop.gtfsId, stop)
    }

    for (const curatedStop of curatedStops) {
      const stop = stopsById.get(curatedStop.stopId)
      if (!stop) continue
      const feature = new Feature({
        geometry: new Point(fromLonLat([stop.lon, stop.lat])),
      })
      feature.set("stop", stop)
      feature.set("curatedStop", curatedStop)
      source.addFeature(feature)
    }

    map.addLayer(layer)

    return () => {
      map.removeLayer(layer)
    }
    // curatedStops is intentionally excluded; curatedKey is its structural digest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, stops, curatedKey])

  return null
}
