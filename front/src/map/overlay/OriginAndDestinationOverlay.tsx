import { use, useEffect, useRef } from "react"
import { Overlay } from "ol"
import { MapContext } from "../MapContext"
import { RouteContext } from "../../route/RouteContext"

export const OriginAndDestinationOverlay = () => {
  const originOverlay = useRef<Overlay | null>(null)
  const originOverlayElement = useRef<HTMLDivElement | null>(null)
  const destinationOverlay = useRef<Overlay | null>(null)
  const destinationOverlayElement = useRef<HTMLDivElement | null>(null)
  const { map } = use(MapContext)
  const { selectedRoute } = use(RouteContext)

  useEffect(() => {
    if (!selectedRoute.origin) {
      return
    }

    if (!originOverlayElement.current) {
      console.error("Origin overlay element reference is not set. Cannot create origin overlay.")
      return
    }

    originOverlay.current = new Overlay({
      position: selectedRoute.origin.coordinates,
      positioning: "center-center",
      element: originOverlayElement.current,
      stopEvent: false,
    })

    map.addOverlay(originOverlay.current)

    return () => {
      if (originOverlay.current) {
        map.removeOverlay(originOverlay.current)
      }
    }
  }, [map, selectedRoute.origin])

  useEffect(() => {
    if (!selectedRoute.destination) {
      return
    }

    if (!destinationOverlayElement.current) {
      console.error("Destination overlay element reference is not set. Cannot create destination overlay.")
      return
    }

    destinationOverlay.current = new Overlay({
      position: selectedRoute.destination.coordinates,
      positioning: "center-center",
      element: destinationOverlayElement.current,
      stopEvent: false,
    })

    map.addOverlay(destinationOverlay.current)

    return () => {
      if (destinationOverlay.current) {
        map.removeOverlay(destinationOverlay.current)
      }
    }
  }, [map, selectedRoute.destination])

  return (
    <>
      <div ref={originOverlayElement} className="origin" />
      <div ref={destinationOverlayElement} className="destination" />
    </>
  )
}
