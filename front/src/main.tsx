import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { MapView } from "./map/MapView"
import { MapContextProvider } from "./map/MapContextProvider"
import { SetOriginAndDestination } from "./map/overlay/SetOriginAndDestination"
import { OriginAndDestinationOverlay } from "./map/overlay/OriginAndDestinationOverlay"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const rootElement = document.getElementById("root")

if (!rootElement) {
  alert("Unable to start the application: Root element not found.")
  throw new Error("Root element not found")
}

const queryClient = new QueryClient()

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MapContextProvider>
        <MapView />
        <OriginAndDestinationOverlay />
        <SetOriginAndDestination />
      </MapContextProvider>
    </QueryClientProvider>
  </StrictMode>
)
