import "ol/ol.css"
import { useEffect } from "react"
import TileLayer from "ol/layer/Tile"
import { OSM } from "ol/source"
import { View, Map } from "ol"

export const MapView = () => {
  useEffect(() => {
    const map = new Map({
      target: "map",
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
      view: new View({
        center: [0, 0],
        zoom: 2,
      }),
    })

    return () => {
      map.setTarget()
    }
  }, [])
  return <div className="fixed top-0 right-0 left-0 bottom-0" id="map" />
}
