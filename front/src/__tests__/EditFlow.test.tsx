import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ApiRoute, StopLinesApiResponse } from "@reitit/back/src/api"
import { RouteContext } from "../route/RouteContext"
import { RouteView } from "../route/RouteView"
import { StopsContext } from "../stops/StopsContext"
import {
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
  StopCardsLayer: ({
    onCardClick,
    onCardRemove,
  }: {
    onCardClick?: (stopId: string) => void
    onCardRemove?: (stopId: string) => void
  }) => (
    <>
      <button data-testid="trigger-edit" onClick={() => onCardClick?.("HSL:1234")}>
        trigger
      </button>
      <button data-testid="trigger-remove" onClick={() => onCardRemove?.("HSL:1234")}>
        trigger remove
      </button>
    </>
  ),
}))

vi.mock("../route/api", () => ({
  useUpdateCuratedLines: vi.fn(),
  useDeleteCuratedStop: vi.fn(),
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
  curatedStops: [{ stopId: "HSL:1234", lines: ["HSL:LINE-A"] }],
}

const fakeStops = [
  { gtfsId: "HSL:1234", name: "Stop Name", lat: 60.0, lon: 24.0 },
]

let updateStub: MutationStub
let deleteStub: MutationStub

function renderView() {
  return render(
    <StopsContext value={{ stops: fakeStops }}>
      <RouteContext value={{ selectedRoute: fakeRoute }}>
        <RouteView />
      </RouteContext>
    </StopsContext>,
  )
}

describe("Edit-flow integration", () => {
  beforeEach(() => {
    updateStub = stubMutation()
    deleteStub = stubMutation()
    vi.mocked(useUpdateCuratedLines).mockReturnValue(
      updateStub as unknown as ReturnType<typeof useUpdateCuratedLines>,
    )
    vi.mocked(useDeleteCuratedStop).mockReturnValue(
      deleteStub as unknown as ReturnType<typeof useDeleteCuratedStop>,
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

  it("opens the LinePicker with the curated stop's name and lines when the card is tapped", () => {
    renderView()
    fireEvent.click(screen.getByTestId("trigger-edit"))
    expect(screen.getByText("Stop Name")).toBeInTheDocument()
    // The pre-selected line should be aria-pressed=true.
    const rowA = screen.getByRole("button", { name: "A" })
    expect(rowA).toHaveAttribute("aria-pressed", "true")
  })

  it("calls useUpdateCuratedLines when saving with one or more lines", async () => {
    renderView()
    fireEvent.click(screen.getByTestId("trigger-edit"))
    // Toggle B on, so selection = [A, B].
    fireEvent.click(screen.getByRole("button", { name: "B" }))
    fireEvent.click(screen.getByRole("button", { name: /save/i }))
    await waitFor(() => {
      expect(updateStub.mutateAsync).toHaveBeenCalledTimes(1)
    })
    expect(deleteStub.mutateAsync).not.toHaveBeenCalled()
    const args = updateStub.mutateAsync.mock.calls[0][0] as {
      routeId: number
      stopId: string
      lines: string[]
    }
    expect(args.routeId).toBe(7)
    expect(args.stopId).toBe("HSL:1234")
    expect([...args.lines].sort()).toEqual(["HSL:LINE-A", "HSL:LINE-B"])
  })

  it("calls useDeleteCuratedStop and not useUpdateCuratedLines when saving with zero lines", async () => {
    renderView()
    fireEvent.click(screen.getByTestId("trigger-edit"))
    // Toggle A off, so selection = [].
    fireEvent.click(screen.getByRole("button", { name: "A" }))
    fireEvent.click(screen.getByRole("button", { name: /save/i }))
    await waitFor(() => {
      expect(deleteStub.mutateAsync).toHaveBeenCalledTimes(1)
    })
    expect(updateStub.mutateAsync).not.toHaveBeenCalled()
    expect(deleteStub.mutateAsync).toHaveBeenCalledWith({
      routeId: 7,
      stopId: "HSL:1234",
    })
  })

  it("calls useDeleteCuratedStop when onCardRemove fires from the StopCardsLayer", async () => {
    renderView()
    fireEvent.click(screen.getByTestId("trigger-remove"))
    await waitFor(() => {
      expect(deleteStub.mutateAsync).toHaveBeenCalledTimes(1)
    })
    expect(updateStub.mutateAsync).not.toHaveBeenCalled()
    expect(deleteStub.mutateAsync).toHaveBeenCalledWith({
      routeId: 7,
      stopId: "HSL:1234",
    })
  })

  it("hides the picker when Cancel is clicked", () => {
    renderView()
    fireEvent.click(screen.getByTestId("trigger-edit"))
    expect(screen.getByText("Stop Name")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(screen.queryByText("Stop Name")).not.toBeInTheDocument()
  })
})
