import { RouteContext } from "./RouteContext"
import { type PropsWithChildren } from "react"
import { useQuery } from "@tanstack/react-query"
import type { RoutesApiResponse, ApiRoute } from "@reitit/back/src/api"
import { create } from "zustand"

interface RouteStore {
  selectedRoute: ApiRoute | null
  setSelectedRoute: (selectedRoute: ApiRoute) => void
}

const useRouteStore = create<RouteStore>((set) => ({
  selectedRoute: null,
  setSelectedRoute: (selectedRoute: ApiRoute) => set({ selectedRoute }),
}))

export const RouteContextProvider = ({ children }: PropsWithChildren) => {
  const selectedRoute = useRouteStore((state) => state.selectedRoute)
  const setSelectedRoute = useRouteStore((state) => state.setSelectedRoute)

  const { data, isLoading, isSuccess } = useQuery({
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

  if (isLoading) {
    return <div>LOADING</div>
  }

  if (!isSuccess) {
    return <div>ERROR LOADING DATA</div>
  }

  if (!selectedRoute) {
    return (
      <div className="px-4 py-2">
        <h1 className="text-2xl font-medium">Valitse reitti</h1>
        <div className="py-2 flex flex-col gap-1">
          {data.routes.map((route) => {
            return (
              <div key={route.id}>
                <button className="button button-primary" type="button" onClick={() => setSelectedRoute(route)}>
                  {route.name}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return <RouteContext value={{ selectedRoute }}>{children}</RouteContext>
}
