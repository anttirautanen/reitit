import { useStore } from "../../useStore"
import { use, useEffect, useRef } from "react"
import { Overlay } from "ol"
import { MapContext } from "../MapContext"
import { useQuery } from "@tanstack/react-query"
import type { RoutesApiResponse } from "@reitit/back/src/api"

export const OriginAndDestinationOverlay = () => {
  const originOverlay = useRef<Overlay | null>(null)
  const originOverlayElement = useRef<HTMLDivElement | null>(null)
  const destinationOverlay = useRef<Overlay | null>(null)
  const destinationOverlayElement = useRef<HTMLDivElement | null>(null)
  const origin = useStore((store) => store.origin)
  const destination = useStore((store) => store.destination)
  const { map } = use(MapContext)

  const query = useQuery({
    queryKey: ["routes"],
    queryFn: async () => {
      const response = await fetch("/api/routes")
      if (!response.ok) {
        throw new Error("Failed to fetch route")
      }

      try {
        return (await response.json()) as RoutesApiResponse
      } catch (error) {
        throw new Error("Failed to parse route response: " + JSON.stringify(error))
      }
    },
  })

  console.log(query.data)

  useEffect(() => {
    if (!origin) {
      return
    }

    if (!originOverlayElement.current) {
      console.error("Origin overlay element reference is not set. Cannot create origin overlay.")
      return
    }

    originOverlay.current = new Overlay({
      position: origin,
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
  }, [map, origin])

  useEffect(() => {
    if (!destination) {
      return
    }

    if (!destinationOverlayElement.current) {
      console.error("Destination overlay element reference is not set. Cannot create destination  overlay.")
      return
    }

    destinationOverlay.current = new Overlay({
      position: destination,
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
  }, [map, destination])

  return (
    <>
      <div ref={originOverlayElement} className="origin" />
      <div ref={destinationOverlayElement} className="destination" />
    </>
  )
}
