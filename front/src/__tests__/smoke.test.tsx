import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

describe("smoke", () => {
  it("renders a heading", () => {
    render(<h1>hello</h1>)
    expect(screen.getByRole("heading", { name: "hello" })).toBeInTheDocument()
  })
})
