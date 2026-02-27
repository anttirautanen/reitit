import { StopsContext } from "./StopsContext"
import { useQuery } from "@tanstack/react-query"
import type { PropsWithChildren } from "react"
import type { StopsApiResponse } from "@reitit/back/src/api"

export const StopsContextProvider = ({ children }: PropsWithChildren) => {
  const { data, isLoading, isSuccess } = useQuery({
    queryKey: ["stops"],
    queryFn: async () => {
      const response = await fetch("/api/stops")
      if (!response.ok) {
        throw new Error("Failed to fetch stops")
      }

      try {
        return (await response.json()) as StopsApiResponse
      } catch (error) {
        throw new Error("Failed to parse stops response: " + JSON.stringify(error))
      }
    },
  })

  if (isLoading) {
    return <div>LOADING</div>
  }

  if (!isSuccess) {
    return <div>ERROR LOADING DATA</div>
  }

  return <StopsContext value={data}>{children}</StopsContext>
}
