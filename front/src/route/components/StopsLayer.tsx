import { use, useEffect } from "react"
import { Feature } from "ol"
import { Point } from "ol/geom"
import VectorLayer from "ol/layer/Vector"
import VectorSource from "ol/source/Vector"
import { fromLonLat } from "ol/proj"
import { Fill, Stroke, Style } from "ol/style"
import CircleStyle from "ol/style/Circle"
import { MapContext } from "../../map/MapContext"
import { useCuratedStopsResolved } from "./useCuratedStopsResolved"

const curatedStopStyle = new Style({
  image: new CircleStyle({
    radius: 6,
    fill: new Fill({ color: "#2563eb" }),
    stroke: new Stroke({ color: "white", width: 2 }),
  }),
})

export const StopsLayer = () => {
  const { map } = use(MapContext)
  const { key, entries } = useCuratedStopsResolved()

  useEffect(() => {
    const source = new VectorSource()
    const layer = new VectorLayer({
      source,
      style: curatedStopStyle,
      updateWhileInteracting: true,
      updateWhileAnimating: true,
    })

    for (const { curatedStop, stop } of entries) {
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
  }, [map, key, entries])

  return null
}
