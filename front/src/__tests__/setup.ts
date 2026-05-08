import "@testing-library/jest-dom/vitest"

if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe() {
      /* no-op for jsdom */
    }
    unobserve() {
      /* no-op for jsdom */
    }
    disconnect() {
      /* no-op for jsdom */
    }
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}
