import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom has no layout engine, so scrolling helpers are no-ops in tests.
Element.prototype.scrollIntoView = () => {}

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
})
