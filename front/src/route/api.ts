import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  ApiRoute,
  DeparturesApiResponse,
  RoutesApiResponse,
  StopLinesApiResponse,
  VehiclesApiResponse,
} from "@reitit/back/src/api"

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  if (!response.ok) {
    let bodyError: string | undefined
    try {
      const body = (await response.json()) as { error?: unknown }
      if (typeof body.error === "string") {
        bodyError = body.error
      }
    } catch {
      // ignore body parse errors when constructing the error message
    }
    const suffix = bodyError ? `: ${bodyError}` : ""
    throw new Error(`Request to ${path} failed with status ${String(response.status)}${suffix}`)
  }
  try {
    return (await response.json()) as T
  } catch (error) {
    throw new Error(`Failed to parse JSON response from ${path}: ${String(error)}`)
  }
}

export function useRoutesQuery() {
  return useQuery<RoutesApiResponse>({
    queryKey: ["routes"],
    queryFn: () => apiFetch<RoutesApiResponse>("/api/routes"),
    staleTime: 0,
  })
}

export function useRouteWithStops(routeId: number | null): {
  route: ApiRoute | undefined
  isLoading: boolean
  isError: boolean
  notFound: boolean
} {
  const { data, isLoading, isError } = useRoutesQuery()
  if (routeId === null) {
    return { route: undefined, isLoading: false, isError: false, notFound: false }
  }
  if (isLoading) {
    return { route: undefined, isLoading: true, isError: false, notFound: false }
  }
  if (isError) {
    return { route: undefined, isLoading: false, isError: true, notFound: false }
  }
  const route = data?.routes.find((route) => route.id === routeId)
  if (route === undefined) {
    return { route: undefined, isLoading: false, isError: false, notFound: true }
  }
  return { route, isLoading: false, isError: false, notFound: false }
}

export function useStopLinesQuery(stopId: string | null) {
  return useQuery<StopLinesApiResponse>({
    queryKey: ["stopLines", stopId],
    queryFn: () =>
      apiFetch<StopLinesApiResponse>(`/api/stops/${encodeURIComponent(String(stopId))}/lines`),
    enabled: stopId !== null,
    staleTime: 60 * 60 * 1000,
  })
}

export function useDeparturesQuery(routeId: number | null) {
  return useQuery<DeparturesApiResponse>({
    queryKey: ["departures", routeId],
    queryFn: () => apiFetch<DeparturesApiResponse>(`/api/routes/${String(routeId)}/departures`),
    enabled: routeId !== null,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 25_000,
  })
}

export function useVehiclesQuery(routeId: number | null) {
  return useQuery<VehiclesApiResponse>({
    queryKey: ["vehicles", routeId],
    queryFn: () => apiFetch<VehiclesApiResponse>(`/api/routes/${String(routeId)}/vehicles`),
    enabled: routeId !== null,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 4_000,
  })
}

interface AddOrUpdateCuratedStopVariables {
  routeId: number
  stopId: string
  lines: string[]
}

export function useAddOrUpdateCuratedStop() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ routeId, stopId, lines }: AddOrUpdateCuratedStopVariables) => {
      return apiFetch<unknown>(`/api/routes/${String(routeId)}/stops`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stopId, lines }),
      })
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["routes"] }),
        queryClient.invalidateQueries({ queryKey: ["departures", variables.routeId] }),
        queryClient.invalidateQueries({ queryKey: ["vehicles", variables.routeId] }),
      ])
    },
  })
}

interface UpdateCuratedLinesVariables {
  routeId: number
  stopId: string
  lines: string[]
}

export function useUpdateCuratedLines() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ routeId, stopId, lines }: UpdateCuratedLinesVariables) => {
      return apiFetch<unknown>(
        `/api/routes/${String(routeId)}/stops/${encodeURIComponent(stopId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines }),
        },
      )
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["routes"] }),
        queryClient.invalidateQueries({ queryKey: ["departures", variables.routeId] }),
        queryClient.invalidateQueries({ queryKey: ["vehicles", variables.routeId] }),
      ])
    },
  })
}

interface DeleteCuratedStopVariables {
  routeId: number
  stopId: string
}

export function useDeleteCuratedStop() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ routeId, stopId }: DeleteCuratedStopVariables) => {
      return apiFetch<unknown>(
        `/api/routes/${String(routeId)}/stops/${encodeURIComponent(stopId)}`,
        {
          method: "DELETE",
        },
      )
    },
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["routes"] }),
        queryClient.invalidateQueries({ queryKey: ["departures", variables.routeId] }),
        queryClient.invalidateQueries({ queryKey: ["vehicles", variables.routeId] }),
      ])
    },
  })
}
