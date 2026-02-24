import "ol/ol.css"
import { useEffect } from "react"
import TileLayer from "ol/layer/Tile"
import { OSM } from "ol/source"
import { Map, View } from "ol"
import { create } from "zustand"
import type { Coordinate } from "ol/coordinate"

interface Store {
  popupIsVisible: boolean
  popupPosition: Coordinate
  showPopup: (position: Coordinate) => void
}

const useStore = create<Store>((set) => ({
  popupIsVisible: false,
  popupPosition: [0, 0],
  showPopup: (position: Coordinate) => set((state) => ({ ...state, popupPosition: position, popupIsVisible: true })),
}))

export const MapView = () => {
  const { popupIsVisible, popupPosition, showPopup } = useStore()

  useEffect(() => {
    const map = new Map({
      target: "map",
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
      view: new View({
        center: [2774811.8562974664, 8441498.843757609],
        zoom: 13,
      }),
    })

    map.on("singleclick", (event) => {
      showPopup(event.coordinate)
    })

    return () => {
      map.setTarget()
    }
  }, [])

  return <div className="fixed top-0 right-0 left-0 bottom-0" id="map" />
}
