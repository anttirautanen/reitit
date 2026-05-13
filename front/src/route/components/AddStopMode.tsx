import { use, useEffect, useMemo } from "react"
import { Feature } from "ol"
import type MapBrowserEvent from "ol/MapBrowserEvent"
import type { Pixel } from "ol/pixel"
import { Point } from "ol/geom"
import VectorLayer from "ol/layer/Vector"
import VectorSource from "ol/source/Vector"
import { fromLonLat } from "ol/proj"
import { Fill, Stroke, Style } from "ol/style"
import CircleStyle from "ol/style/Circle"
import type { ApiStop } from "@reitit/back/src/api"
import { MapContext } from "../../map/MapContext"
import { StopsContext } from "../../stops/StopsContext"
import { RouteContext } from "../RouteContext"

interface AddStopModeProps {
  onPickStop: (stopId: string) => void
}

const allStopStyle = new Style({
  image: new CircleStyle({
    radius: 4,
    fill: new Fill({ color: "#6b7280" }),
    stroke: new Stroke({ color: "white", width: 1 }),
  }),
})

export const AddStopMode = ({ onPickStop }: AddStopModeProps) => {
  const { map } = use(MapContext)
  const { stops } = use(StopsContext)
  const { selectedRoute } = use(RouteContext)

  const visibleStops = useMemo<ApiStop[]>(() => {
    const curatedSet = new Set(selectedRoute.curatedStops.map((c) => c.stopId))
    return stops.filter((s) => !curatedSet.has(s.gtfsId))
  }, [stops, selectedRoute.curatedStops])

  useEffect(() => {
    const source = new VectorSource()
    const layer = new VectorLayer({
      source,
      style: allStopStyle,
      updateWhileInteracting: true,
      updateWhileAnimating: true,
    })

    for (const stop of visibleStops) {
      const feature = new Feature({
        geometry: new Point(fromLonLat([stop.lon, stop.lat])),
      })
      feature.set("stop", stop)
      feature.setId(stop.gtfsId)
      source.addFeature(feature)
    }

    map.addLayer(layer)

    const handleClick = (event: MapBrowserEvent) => {
      const pixel: Pixel = event.pixel
      map.forEachFeatureAtPixel(
        pixel,
        (feature) => {
          const id = feature.getId()
          if (typeof id === "string") {
            onPickStop(id)
            return true
          }
          return false
        },
        { layerFilter: (candidate) => candidate === layer },
      )
    }

    map.on("singleclick", handleClick)

    return () => {
      map.un("singleclick", handleClick)
      map.removeLayer(layer)
    }
  }, [map, visibleStops, onPickStop])

  return null
}
