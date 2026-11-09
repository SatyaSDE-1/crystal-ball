/**
 * A hand-driven async stream for tests: push values (or fail/end it) at
 * chosen moments, so a test can look at the UI between two tokens.
 */
export function createChannel<T>() {
  type Item = { value: T } | { error: unknown } | { done: true }
  const items: Item[] = []
  let wake: (() => void) | null = null

  const signal = () => {
    wake?.()
    wake = null
  }

  async function* iterate(): AsyncGenerator<T> {
    while (true) {
      while (items.length === 0) {
        await new Promise<void>(resolve => {
          wake = resolve
        })
      }
      const item = items.shift() as Item
      if ('error' in item) throw item.error
      if ('done' in item) return
      yield item.value
    }
  }

  return {
    iterable: iterate(),
    push(value: T) {
      items.push({ value })
      signal()
    },
    end() {
      items.push({ done: true })
      signal()
    },
    fail(error: unknown) {
      items.push({ error })
      signal()
    },
  }
}
