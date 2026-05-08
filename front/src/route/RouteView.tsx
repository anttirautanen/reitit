import { MapView } from "../map/MapView"
import { TopBar } from "./components/TopBar"

interface RouteViewProps {
  onAddStop?: () => void
}

export const RouteView = ({ onAddStop }: RouteViewProps) => {
  return (
    <>
      <TopBar onAddStop={onAddStop} />
      <MapView />
    </>
  )
}
