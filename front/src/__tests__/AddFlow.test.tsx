import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ApiRoute, StopLinesApiResponse } from "@reitit/back/src/api"
import { RouteContext } from "../route/RouteContext"
import { RouteView } from "../route/RouteView"
import { StopsContext } from "../stops/StopsContext"
import {
  useAddOrUpdateCuratedStop,
  useDeleteCuratedStop,
  useStopLinesQuery,
  useUpdateCuratedLines,
} from "../route/api"

vi.mock("../map/MapView", () => ({
  MapView: () => <div data-testid="map-view-stub" />,
}))
vi.mock("../route/components/StopsLayer", () => ({
  StopsLayer: () => null,
}))
vi.mock("../route/components/VehiclesLayer", () => ({
  VehiclesLayer: () => null,
}))
vi.mock("../route/components/EmptyState", () => ({
  EmptyState: () => null,
}))
vi.mock("../route/components/StaleIndicator", () => ({
  StaleIndicator: () => null,
}))
vi.mock("../route/components/StopCardsLayer", () => ({
  StopCardsLayer: () => null,
}))
vi.mock("../route/components/AddStopMode", () => ({
  AddStopMode: ({ onPickStop }: { onPickStop: (stopId: string) => void }) => (
    <button data-testid="trigger-pick" onClick={() => { onPickStop("HSL:NEW") }}>
      pick stop
    </button>
  ),
}))

vi.mock("../route/api", () => ({
  useUpdateCuratedLines: vi.fn(),
  useDeleteCuratedStop: vi.fn(),
  useAddOrUpdateCuratedStop: vi.fn(),
  useStopLinesQuery: vi.fn(),
}))

interface MutationStub {
  mutateAsync: ReturnType<typeof vi.fn>
  error: Error | null
}

function stubMutation(): MutationStub {
  return { mutateAsync: vi.fn().mockResolvedValue(undefined), error: null }
}

const lines: StopLinesApiResponse = {
  lines: [
    { gtfsId: "HSL:LINE-A", shortName: "A", mode: "BUS" },
    { gtfsId: "HSL:LINE-B", shortName: "B", mode: "BUS" },
  ],
}

const fakeRoute: ApiRoute = {
  id: 7,
  name: "Test route",
  origin: null,
  destination: null,
  curatedStops: [],
}

const fakeStops = [
  { gtfsId: "HSL:NEW", name: "New Stop", lat: 60.0, lon: 24.0 },
]

let updateStub: MutationStub
let deleteStub: MutationStub
let addStub: MutationStub

function renderView() {
  return render(
    <StopsContext value={{ stops: fakeStops }}>
      <RouteContext value={{ selectedRoute: fakeRoute }}>
        <RouteView />
      </RouteContext>
    </StopsContext>,
  )
}

describe("Add-flow integration", () => {
  beforeEach(() => {
    updateStub = stubMutation()
    deleteStub = stubMutation()
    addStub = stubMutation()
    vi.mocked(useUpdateCuratedLines).mockReturnValue(
      updateStub as unknown as ReturnType<typeof useUpdateCuratedLines>,
    )
    vi.mocked(useDeleteCuratedStop).mockReturnValue(
      deleteStub as unknown as ReturnType<typeof useDeleteCuratedStop>,
    )
    vi.mocked(useAddOrUpdateCuratedStop).mockReturnValue(
      addStub as unknown as ReturnType<typeof useAddOrUpdateCuratedStop>,
    )
    vi.mocked(useStopLinesQuery).mockReturnValue({
      data: lines,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useStopLinesQuery>)
  })

  afterEach(() => {
    cleanup()
    vi.resetAllMocks()
  })

  it("toggles the top-bar label to Done when add-stop mode is active", () => {
    renderView()
    expect(screen.getByRole("button", { name: /\+ add stop/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /\+ add stop/i }))
    expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument()
    expect(screen.queryByTestId("trigger-pick")).toBeInTheDocument()
  })

  it("calls useAddOrUpdateCuratedStop with the right vars after picking a stop and saving", async () => {
    renderView()
    // Enter add-stop mode.
    fireEvent.click(screen.getByRole("button", { name: /\+ add stop/i }))
    // Pick a non-curated stop via the mocked layer.
    fireEvent.click(screen.getByTestId("trigger-pick"))
    // Picker opens for the new stop.
    expect(screen.getByText("New Stop")).toBeInTheDocument()
    // Tick line A.
    fireEvent.click(screen.getByRole("button", { name: "A" }))
    fireEvent.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(addStub.mutateAsync).toHaveBeenCalledTimes(1)
    })
    expect(updateStub.mutateAsync).not.toHaveBeenCalled()
    expect(deleteStub.mutateAsync).not.toHaveBeenCalled()
    expect(addStub.mutateAsync).toHaveBeenCalledWith({
      routeId: 7,
      stopId: "HSL:NEW",
      lines: ["HSL:LINE-A"],
    })
  })

  it("exits add-stop mode and closes the picker when Done is clicked", () => {
    renderView()
    fireEvent.click(screen.getByRole("button", { name: /\+ add stop/i }))
    fireEvent.click(screen.getByTestId("trigger-pick"))
    expect(screen.getByText("New Stop")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /done/i }))
    expect(screen.queryByText("New Stop")).not.toBeInTheDocument()
    expect(screen.queryByTestId("trigger-pick")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /\+ add stop/i })).toBeInTheDocument()
  })
})
