import { createContext } from "react"
import { Map } from "ol"

interface MapContextInterface {
  map: Map
}

export const MapContext = createContext<MapContextInterface>({} as MapContextInterface)
