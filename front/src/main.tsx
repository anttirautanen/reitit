import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { MapContextProvider } from "./map/MapContextProvider"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouteContextProvider } from "./route/RouteContextProvider"
import { StopsContextProvider } from "./stops/StopsContextProvider"

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
        <StopsContextProvider>
          <RouteContextProvider />
        </StopsContextProvider>
      </MapContextProvider>
    </QueryClientProvider>
  </StrictMode>
)
