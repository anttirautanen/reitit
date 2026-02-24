import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

const rootElement = document.getElementById("root")

if (!rootElement) {
  alert("Unable to start the application: Root element not found.")
  throw new Error("Root element not found")
}

createRoot(rootElement).render(
  <StrictMode>
  </StrictMode>,
)
