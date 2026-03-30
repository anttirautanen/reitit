import { Map, View } from "ol"
import TileLayer from "ol/layer/Tile"
import { type PropsWithChildren, useMemo } from "react"
import { MapContext } from "./MapContext"
import ImageTileSource from "ol/source/ImageTile"

export const MapContextProvider = ({ children }: PropsWithChildren) => {
  const map = useMemo(
    () =>
      new Map({
        layers: [
          new TileLayer({
            source: new ImageTileSource({
              url: (z, x, y) => `/api/tiles/${z.toString(10)}/${x.toString(10)}/${y.toString(10)}`,
              maxZoom: 22,
            }),
          }),
        ],
        view: new View({
          center: [2774811.8562974664, 8441498.843757609],
          zoom: 13,
          maxZoom: 22,
        }),
      }),
    []
  )

  return <MapContext value={{ map }}>{children}</MapContext>
}
