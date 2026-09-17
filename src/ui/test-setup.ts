// Runs before every *.test.tsx file (the `dom` project in vitest.config.ts).
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)

// jsdom lacks a few things the libraries call. Each was checked by removing it.
// MantineProvider: without matchMedia, nothing renders.
window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList
// Select, MultiSelect and ScrollArea observe their size.
window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// Select scrolls to the highlighted option when driven with the keyboard.
window.HTMLElement.prototype.scrollIntoView = () => {}
// The router restores the scroll position on load; jsdom only prints "Not implemented".
window.scrollTo = () => {}
