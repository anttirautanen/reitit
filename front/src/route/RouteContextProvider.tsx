import { RouteContext } from "./RouteContext"
import { type PropsWithChildren } from "react"
import { useQuery } from "@tanstack/react-query"
import type { RoutesApiResponse } from "@reitit/back/src/api"
import { create } from "zustand"

interface RouteStore {
  selectedRouteId: number | null
  setSelectedRoute: (selectedRouteId: number) => void
}

const useRouteStore = create<RouteStore>((set) => ({
  selectedRouteId: null,
  setSelectedRoute: (selectedRouteId: number) => set({ selectedRouteId }),
}))

export const RouteContextProvider = ({ children }: PropsWithChildren) => {
  const selectedRouteId = useRouteStore((state) => state.selectedRouteId)
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

  const selectedRoute = data.routes.find((route) => route.id === selectedRouteId)
  if (!selectedRoute) {
    return (
      <div className="px-4 py-2">
        <h1 className="text-2xl font-medium">Valitse reitti</h1>
        <div className="py-2 flex flex-col gap-1">
          {data.routes.map((route) => {
            return (
              <div key={route.id}>
                <button className="button button-primary" type="button" onClick={() => setSelectedRoute(route.id)}>
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
