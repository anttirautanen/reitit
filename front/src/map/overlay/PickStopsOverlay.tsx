import { use, useEffect, useRef } from "react"
import { MapContext } from "../MapContext"
import { Feature } from "ol"
import { fromLonLat } from "ol/proj"
import { StopsContext } from "../../stops/StopsContext"
import VectorLayer from "ol/layer/Vector"
import VectorSource from "ol/source/Vector"
import { Point } from "ol/geom"
import { Fill, Stroke, Style } from "ol/style"
import CircleStyle from "ol/style/Circle"

export const PickStopsOverlay = () => {
  const { map } = use(MapContext)
  const vectorLayerRef = useRef<VectorLayer<VectorSource> | null>(null)
  const vectorSourceRef = useRef<VectorSource | null>(null)
  const { stops } = use(StopsContext)

  useEffect(() => {
    if (!vectorLayerRef.current) {
      const vectorSource = new VectorSource()
      vectorSourceRef.current = vectorSource
      vectorLayerRef.current = new VectorLayer({
        source: vectorSourceRef.current,
        style: new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: "rgb(83,193,77)" }),
            stroke: new Stroke({ color: "white", width: 2 }),
          }),
        }),
        updateWhileInteracting: true,
        updateWhileAnimating: true,
      })

      stops.forEach((stop) => {
        const feature = new Feature({
          geometry: new Point(fromLonLat([stop.lon, stop.lat])),
          stop: stop,
        })
        vectorSource.addFeature(feature)
      })

      map.addLayer(vectorLayerRef.current)
    }

    return () => {
      if (vectorLayerRef.current) {
        map.removeLayer(vectorLayerRef.current)
        vectorLayerRef.current = null

        if (vectorSourceRef.current) {
          vectorSourceRef.current.clear()
        }
        vectorSourceRef.current = null
      }
    }
  }, [map, stops])

  return null
}
