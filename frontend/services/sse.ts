export type SseFrame = { event: string; data: string }

function parseFrame(raw: string): SseFrame | null {
  let event = ''
  const data: string[] = []

  for (const line of raw.split('\n')) {
    if (line === '' || line.startsWith(':')) continue // blank or comment

    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')

    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
    // id, retry and unknown fields are not used here
  }

  if (!event && data.length === 0) return null
  return { event: event || 'message', data: data.join('\n') }
}

/**
 * Turns a stream of bytes (or text) into Server-Sent Events frames. Frames
 * may be split across chunks, several may arrive in one chunk, and
 * multi-byte characters may be cut between chunks; all are handled. A frame
 * that never finished (no blank line) is dropped.
 */
export async function* parseSseStream(
  source: AsyncIterable<Uint8Array | string>,
): AsyncGenerator<SseFrame> {
  const decoder = new TextDecoder()
  let buffer = ''

  for await (const chunk of source) {
    buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true })
    buffer = buffer.replace(/\r\n/g, '\n')

    let end = buffer.indexOf('\n\n')
    while (end !== -1) {
      const frame = parseFrame(buffer.slice(0, end))
      buffer = buffer.slice(end + 2)
      if (frame) yield frame
      end = buffer.indexOf('\n\n')
    }
  }
}
