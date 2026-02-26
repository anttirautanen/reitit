import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { MapView } from "./MapView"
import { MapContextProvider } from "./MapContextProvider"
import { SetOriginAndDestination } from "./SetOriginAndDestination"

const rootElement = document.getElementById("root")

if (!rootElement) {
  alert("Unable to start the application: Root element not found.")
  throw new Error("Root element not found")
}

createRoot(rootElement).render(
  <StrictMode>
    <MapContextProvider>
      <MapView />
      <SetOriginAndDestination />
    </MapContextProvider>
  </StrictMode>
)
