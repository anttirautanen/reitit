import { use } from "react"
import { RouteContext } from "../RouteContext"
import { useDeparturesQuery, useVehiclesQuery } from "../api"

function useStaleIndicator(routeId: number | null): boolean {
  const departures = useDeparturesQuery(routeId)
  const vehicles = useVehiclesQuery(routeId)
  if (routeId === null) return false
  const departuresStale = departures.isError && departures.failureCount >= 2
  const vehiclesStale = vehicles.isError && vehicles.failureCount >= 2
  return departuresStale || vehiclesStale
}

export const StaleIndicator = () => {
  const { selectedRoute } = use(RouteContext)
  const isStale = useStaleIndicator(selectedRoute.id)
  if (!isStale) return null
  return (
    <span
      role="status"
      aria-label="Stale data"
      className="bg-yellow-200 text-yellow-900 text-xs px-2 py-0.5 rounded"
    >
      Stale
    </span>
  )
}
