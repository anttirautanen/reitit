import { use, useCallback, useEffect, useState } from "react"
import { MapContext } from "../MapContext"
import type { ObjectEvent } from "ol/Object"
import type { View } from "ol"
import type { Coordinate } from "ol/coordinate"
import { useThrottler } from "@tanstack/react-pacer"

export const PickStopsOverlay = () => {
  const { map } = use(MapContext)
  const [isVisible, setIsVisible] = useState(false)
  const [center, setCenter] = useState<Coordinate>([0, 0])

  const onChangeResolution = useCallback(
    (event: ObjectEvent) => {
      const targetView = event.target as View
      const resolution = targetView.getResolution()
      if (resolution === undefined) return
      if (resolution <= 2 && !isVisible) {
        setIsVisible(true)
      } else if (resolution > 2 && isVisible) {
        setIsVisible(false)
      }
    },
    [isVisible]
  )

  const handleChangeCenter = useCallback(() => {
    const center = map.getView().getCenter()
    if (center) {
      setCenter(center)
    }
  }, [map])

  const onChangeCenter = useThrottler(handleChangeCenter, { wait: 1000 })

  useEffect(() => {
    map.getView().on("change:resolution", onChangeResolution)
    map.getView().on("change:center", onChangeCenter.maybeExecute)

    return () => {
      map.getView().un("change:resolution", onChangeResolution)
      map.getView().un("change:center", onChangeCenter.maybeExecute)
    }
  }, [map, onChangeCenter, onChangeResolution])

  if (isVisible) {
    return <div>stops visible {center}</div>
  }

  return <div>stops hidden</div>
}
