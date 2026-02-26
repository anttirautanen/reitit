import "ol/ol.css"
import { use, useEffect, useRef } from "react"
import { MapContext } from "./MapContext"

export const MapView = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const { map } = use(MapContext)

  useEffect(() => {
    if (!mapContainerRef.current) {
      console.error("Map container reference is not set. Map will not be initialized.")
      return
    }

    map.setTarget(mapContainerRef.current)

    return () => map.setTarget()
  }, [map, mapContainerRef])

  return <div ref={mapContainerRef} className="fixed top-0 right-0 left-0 bottom-0" />
}
