export interface POI {
  name: string
  coordinates: [number, number]
}

export interface ApiRoute {
  id: number
  name: string
  origin: POI | null
  destination: POI | null
}

export interface RoutesApiResponse {
  routes: ApiRoute[]
}

export interface ApiStop {
  gtfsId: string
  name: string
  lat: number
  lon: number
}

export interface StopsApiResponse {
  stops: ApiStop[]
}
