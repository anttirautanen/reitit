import { use, useState } from "react"
import { MapView } from "../map/MapView"
import { StopsContext } from "../stops/StopsContext"
import { useDeleteCuratedStop, useUpdateCuratedLines } from "./api"
import { EmptyState } from "./components/EmptyState"
import { LinePicker } from "./components/LinePicker"
import { StopCardsLayer } from "./components/StopCardsLayer"
import { StopsLayer } from "./components/StopsLayer"
import { TopBar } from "./components/TopBar"
import { VehiclesLayer } from "./components/VehiclesLayer"
import { RouteContext } from "./RouteContext"

interface RouteViewProps {
  onAddStop?: () => void
}

interface EditingStop {
  stopId: string
  stopName: string
  initialSelected: string[]
}

export const RouteView = ({ onAddStop }: RouteViewProps) => {
  const { selectedRoute } = use(RouteContext)
  const { stops } = use(StopsContext)
  const [editing, setEditing] = useState<EditingStop | null>(null)
  const updateLines = useUpdateCuratedLines()
  const deleteStop = useDeleteCuratedStop()

  const handleCardClick = (stopId: string) => {
    const curated = selectedRoute.curatedStops.find((c) => c.stopId === stopId)
    if (!curated) return
    const stop = stops.find((s) => s.gtfsId === stopId)
    const stopName = stop?.name ?? stopId
    setEditing({ stopId, stopName, initialSelected: curated.lines })
  }

  const handleSave = async (newLines: string[]) => {
    if (!editing) return
    const routeId = selectedRoute.id
    if (newLines.length === 0) {
      await deleteStop.mutateAsync({ routeId, stopId: editing.stopId })
    } else {
      await updateLines.mutateAsync({ routeId, stopId: editing.stopId, lines: newLines })
    }
    setEditing(null)
  }

  const saveError = updateLines.error?.message ?? deleteStop.error?.message ?? null

  return (
    <>
      <TopBar onAddStop={onAddStop} />
      <MapView />
      <StopsLayer />
      <StopCardsLayer onCardClick={handleCardClick} />
      <VehiclesLayer />
      <EmptyState />
      {editing ? (
        <LinePicker
          stopId={editing.stopId}
          stopName={editing.stopName}
          mode="edit"
          initialSelected={editing.initialSelected}
          onSave={handleSave}
          onCancel={() => {
            setEditing(null)
          }}
          saveError={saveError}
        />
      ) : null}
    </>
  )
}
