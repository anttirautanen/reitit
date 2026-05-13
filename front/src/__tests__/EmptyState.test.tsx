import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import type { ApiRoute } from "@reitit/back/src/api"
import { RouteContext } from "../route/RouteContext"
import { EmptyState } from "../route/components/EmptyState"

const baseRoute: ApiRoute = {
  id: 1,
  name: "Test route",
  origin: null,
  destination: null,
  curatedStops: [],
}

function renderEmptyState(selectedRoute: ApiRoute) {
  return render(
    <RouteContext value={{ selectedRoute }}>
      <EmptyState />
    </RouteContext>,
  )
}

describe("EmptyState", () => {
  afterEach(() => {
    cleanup()
  })

  it("is hidden when the route has at least one curated stop", () => {
    const route: ApiRoute = {
      ...baseRoute,
      curatedStops: [{ stopId: "HSL:1000101", lines: ["HSL:1001"] }],
    }

    renderEmptyState(route)

    expect(screen.queryByText(/No stops yet/)).not.toBeInTheDocument()
  })

  it("is visible with the prompt when the route has no curated stops", () => {
    renderEmptyState(baseRoute)

    expect(
      screen.getByText("No stops yet — tap “Add stop” to choose stops to watch."),
    ).toBeInTheDocument()
  })
})
