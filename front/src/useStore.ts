import { create } from "zustand"
import type { Coordinate } from "ol/coordinate"

interface Store {
  origin: Coordinate | null
  destination: Coordinate | null
  setOrigin: (origin: Coordinate) => void
  setDestination: (destination: Coordinate) => void
}

export const useStore = create<Store>((set) => ({
  origin: null,
  destination: null,
  setOrigin: (origin: Coordinate) => set({ origin }),
  setDestination: (destination: Coordinate) => set({ destination }),
}))
