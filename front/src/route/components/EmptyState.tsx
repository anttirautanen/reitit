import { use } from "react"
import { RouteContext } from "../RouteContext"

export const EmptyState = () => {
  const { selectedRoute } = use(RouteContext)
  if (selectedRoute.curatedStops.length > 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 flex justify-center px-4 z-10">
      <div className="pointer-events-auto bg-white rounded-md shadow-md px-4 py-3 max-w-sm text-center">
        <p className="text-sm text-gray-800">
          No stops yet — tap “Add stop” to choose stops to watch.
        </p>
      </div>
    </div>
  )
}
