import { use, useCallback, useEffect, useRef } from "react"
import { MapContext } from "../MapContext"
import { MapBrowserEvent, Overlay } from "ol"
import type { Coordinate } from "ol/coordinate"
import { create } from "zustand"
import type BaseEvent from "ol/events/Event"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { RouteContext } from "../../route/RouteContext"

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
  const { selectedRoute } = use(RouteContext)
  const queryClient = useQueryClient()

  const mutateOrigin = useMutation({
    mutationFn: async (origin: Coordinate) => {
      const response = await fetch(`/api/routes/${selectedRoute.id.toString()}/origin`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ coordinates: origin }),
      })

      if (!response.ok) {
        throw new Error("Failed to set origin")
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["routes"] })
    },
  })

  const mutateDestination = useMutation({
    mutationFn: async (destination: Coordinate) => {
      const response = await fetch(`/api/routes/${selectedRoute.id.toString()}/destination`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ coordinates: destination }),
      })

      if (!response.ok) {
        throw new Error("Failed to set destination")
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["routes"] })
    },
  })

  const handleMapClick = useCallback(
    (event: Event | BaseEvent) => {
      const mapBrowserEvent = event as MapBrowserEvent<PointerEvent>
      showPopup(mapBrowserEvent.coordinate)
    },
    [showPopup]
  )

  const onClickSetOrigin = useCallback(() => {
    if (!popupPosition) {
      console.error("Popup position is not set. Cannot set origin.")
      return
    }
    mutateOrigin.mutate(popupPosition)
    hidePopup()
  }, [hidePopup, mutateOrigin, popupPosition])

  const onClickSetDestination = useCallback(() => {
    if (!popupPosition) {
      console.error("Popup position is not set. Cannot set destination.")
      return
    }
    mutateDestination.mutate(popupPosition)
    hidePopup()
  }, [hidePopup, mutateDestination, popupPosition])

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
    map.on(["singleclick"], handleMapClick)

    return () => {
      map.un(["singleclick"], handleMapClick)
    }
  }, [handleMapClick, map])

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
        <button className="button button-origin" onClick={onClickSetOrigin}>
          Lähtö
        </button>
        <button className="button button-destination" onClick={onClickSetDestination}>
          Määränpää
        </button>
      </div>
    </div>
  )
}
