import { createContext } from "react"
import type { ApiStop } from "@reitit/back/src/api"

interface StopsContextInterface {
  stops: ApiStop[]
}

export const StopsContext = createContext<StopsContextInterface>({} as StopsContextInterface)
