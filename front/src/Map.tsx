import "ol/ol.css"
import { useEffect, useRef } from "react"
import TileLayer from "ol/layer/Tile"
import { OSM } from "ol/source"
import { Map, Overlay, View } from "ol"
import { create } from "zustand"
import type { Coordinate } from "ol/coordinate"

interface Store {
  overlay: Overlay | null
  setOverlay: (overlay: Overlay) => void
  popupIsVisible: boolean
  popupPosition: Coordinate
  showPopup: (position: Coordinate) => void
  hidePopup: () => void
}

const useStore = create<Store>((set) => ({
  overlay: null,
  setOverlay: (overlay: Overlay) => set((state) => ({ ...state, overlay })),
  popupIsVisible: false,
  popupPosition: [0, 0],
  showPopup: (position: Coordinate) => set((state) => ({ ...state, popupPosition: position, popupIsVisible: true })),
  hidePopup: () => set((state) => ({ ...state, popupIsVisible: false })),
}))

export const MapView = () => {
  const { overlay, setOverlay, popupIsVisible, popupPosition, showPopup, hidePopup } = useStore()
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const overlayContentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!overlayRef.current) {
      throw new Error("Overlay reference is not set")
    }

    setOverlay(
      new Overlay({
        element: overlayRef.current,
        autoPan: {
          animation: {
            duration: 250,
          },
        },
      })
    )
  }, [setOverlay])

  useEffect(() => {
    if (!overlay) {
      return
    }

    const map = new Map({
      target: "map",
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
      overlays: [overlay],
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
  }, [overlay, showPopup])

  useEffect(() => {
    if (!overlay) {
      return
    }

    if (popupIsVisible) {
      overlay.setPosition(popupPosition)
    } else {
      overlay.setPosition(undefined)
    }
  }, [popupIsVisible, popupPosition, overlay])

  return (
    <>
      <div ref={overlayRef} className="ol-popup">
        <button type="button" className="ol-popup-closer" onClick={hidePopup}></button>
        <div ref={overlayContentRef} className="flex gap-2">
          <button className="button">Lähtö</button>
          <button className="button">Määränpää</button>
        </div>
      </div>
      <div className="fixed top-0 right-0 left-0 bottom-0" id="map" />
    </>
  )
}
