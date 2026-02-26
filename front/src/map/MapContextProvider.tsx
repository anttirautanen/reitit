import { Map, View } from "ol"
import TileLayer from "ol/layer/Tile"
import { OSM } from "ol/source"
import { type PropsWithChildren, useMemo } from "react"
import { MapContext } from "./MapContext"

export const MapContextProvider = ({ children }: PropsWithChildren) => {
  const map = useMemo(
    () =>
      new Map({
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
        ],
        view: new View({
          center: [2774811.8562974664, 8441498.843757609],
          zoom: 13,
        }),
      }),
    []
  )

  return <MapContext value={{ map }}>{children}</MapContext>
}
