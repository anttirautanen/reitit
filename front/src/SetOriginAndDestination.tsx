import { use, useCallback, useEffect, useRef } from "react"
import { MapContext } from "./MapContext"
import { MapBrowserEvent, Overlay } from "ol"
import type { Coordinate } from "ol/coordinate"
import { create } from "zustand"
import type BaseEvent from "ol/events/Event"

interface PopupState {
  popupPosition: Coordinate | null
  showPopup: (position: Coordinate) => void
  hidePopup: () => void
}

const usePopupState = create<PopupState>((set) => ({
  popupPosition: null,
  showPopup: (position: Coordinate) => set(() => ({ popupPosition: position })),
  hidePopup: () => set(() => ({ popupPosition: null })),
}))

export const SetOriginAndDestination = () => {
  const overlayContainerRef = useRef<HTMLDivElement>(null)
  const { showPopup, hidePopup, popupPosition } = usePopupState()
  const overlay = useRef<Overlay>(null)
  const { map } = use(MapContext)

  const handleClick = useCallback(
    (event: Event | BaseEvent) => {
      const mapBrowserEvent = event as MapBrowserEvent<PointerEvent>
      showPopup(mapBrowserEvent.coordinate)
    },
    [showPopup]
  )

  useEffect(() => {
    if (!overlayContainerRef.current) {
      console.error("Overlay container reference is not set. Overlay will not be initialized.")
      return
    }

    overlay.current = new Overlay({
      element: overlayContainerRef.current,
      autoPan: {
        animation: {
          duration: 250,
        },
      },
    })

    map.addOverlay(overlay.current)
    map.on(["singleclick"], handleClick)

    return () => {
      map.un(["singleclick"], handleClick)
    }
  }, [handleClick, map])

  useEffect(() => {
    if (overlay.current) {
      overlay.current.setPosition(popupPosition ?? undefined)
    }
  }, [popupPosition])

  return (
    <div ref={overlayContainerRef} className="ol-popup">
      <button type="button" className="ol-popup-closer" onClick={hidePopup}>
        &times;
      </button>
      <div className="flex gap-2">
        <button className="button">Lähtö</button>
        <button className="button">Määränpää</button>
      </div>
    </div>
  )
}
