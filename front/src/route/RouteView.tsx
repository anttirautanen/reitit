import { MapView } from "../map/MapView"
import { EmptyState } from "./components/EmptyState"
import { StopCardsLayer } from "./components/StopCardsLayer"
import { StopsLayer } from "./components/StopsLayer"
import { TopBar } from "./components/TopBar"
import { VehiclesLayer } from "./components/VehiclesLayer"

interface RouteViewProps {
  onAddStop?: () => void
}

export const RouteView = ({ onAddStop }: RouteViewProps) => {
  return (
    <>
      <TopBar onAddStop={onAddStop} />
      <MapView />
      <StopsLayer />
      <StopCardsLayer />
      <VehiclesLayer />
      <EmptyState />
    </>
  )
}
