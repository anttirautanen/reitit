import { use, useCallback, useState } from "react"
import { MapView } from "../map/MapView"
import { StopsContext } from "../stops/StopsContext"
import {
  useAddOrUpdateCuratedStop,
  useDeleteCuratedStop,
  useUpdateCuratedLines,
} from "./api"
import { AddStopMode } from "./components/AddStopMode"
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

interface AddingStop {
  stopId: string
  stopName: string
}

export const RouteView = ({ onAddStop }: RouteViewProps) => {
  const { selectedRoute } = use(RouteContext)
  const { stops } = use(StopsContext)
  const [editing, setEditing] = useState<EditingStop | null>(null)
  const [addStopMode, setAddStopMode] = useState(false)
  const [addingStop, setAddingStop] = useState<AddingStop | null>(null)
  const updateLines = useUpdateCuratedLines()
  const deleteStop = useDeleteCuratedStop()
  const addOrUpdateStop = useAddOrUpdateCuratedStop()

  const handleCardClick = (stopId: string) => {
    const curated = selectedRoute.curatedStops.find((c) => c.stopId === stopId)
    if (!curated) return
    const stop = stops.find((s) => s.gtfsId === stopId)
    const stopName = stop?.name ?? stopId
    setEditing({ stopId, stopName, initialSelected: curated.lines })
  }

  const handleCardRemove = useCallback(
    (stopId: string) => {
      void deleteStop.mutateAsync({ routeId: selectedRoute.id, stopId })
    },
    [deleteStop, selectedRoute.id],
  )

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

  const handlePickStop = useCallback(
    (stopId: string) => {
      const stop = stops.find((s) => s.gtfsId === stopId)
      const stopName = stop?.name ?? stopId
      setAddingStop({ stopId, stopName })
    },
    [stops],
  )

  const handleAddSave = async (newLines: string[]) => {
    if (!addingStop) return
    if (newLines.length === 0) {
      setAddingStop(null)
      return
    }
    await addOrUpdateStop.mutateAsync({
      routeId: selectedRoute.id,
      stopId: addingStop.stopId,
      lines: newLines,
    })
    setAddingStop(null)
  }

  const toggleAddStopMode = () => {
    setAddStopMode((prev) => {
      const next = !prev
      if (!next) {
        setAddingStop(null)
      }
      return next
    })
    onAddStop?.()
  }

  const editSaveError = updateLines.error?.message ?? deleteStop.error?.message ?? null
  const addSaveError = addOrUpdateStop.error?.message ?? null

  return (
    <>
      <TopBar onAddStop={toggleAddStopMode} addStopMode={addStopMode} />
      <MapView />
      <StopsLayer />
      <StopCardsLayer onCardClick={handleCardClick} onCardRemove={handleCardRemove} />
      <VehiclesLayer />
      <EmptyState />
      {addStopMode ? <AddStopMode onPickStop={handlePickStop} /> : null}
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
          saveError={editSaveError}
        />
      ) : null}
      {addingStop ? (
        <LinePicker
          stopId={addingStop.stopId}
          stopName={addingStop.stopName}
          mode="add"
          initialSelected={[]}
          onSave={handleAddSave}
          onCancel={() => {
            setAddingStop(null)
          }}
          saveError={addSaveError}
        />
      ) : null}
    </>
  )
}
