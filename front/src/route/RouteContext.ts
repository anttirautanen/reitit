import { createContext } from "react"
import type { ApiRoute } from "@reitit/back/src/api"

interface RouteContextInterface {
  selectedRoute: ApiRoute
}

export const RouteContext = createContext<RouteContextInterface>({} as RouteContextInterface)
