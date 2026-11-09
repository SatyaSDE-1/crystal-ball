import { describe, expect, it } from 'vitest'
import { parseSseStream } from './sse'

const encoder = new TextEncoder()

async function* chunks(...parts: (string | Uint8Array)[]) {
  for (const part of parts) {
    await Promise.resolve()
    yield part
  }
}

async function collect(source: AsyncIterable<{ event: string; data: string }>) {
  const frames: { event: string; data: string }[] = []
  for await (const frame of source) frames.push(frame)
  return frames
}

describe('parseSseStream', () => {
  it('parses one frame', async () => {
    const frames = await collect(
      parseSseStream(chunks('event: token\ndata: {"text":"Hi"}\n\n')),
    )

    expect(frames).toEqual([{ event: 'token', data: '{"text":"Hi"}' }])
  })

  it('parses several frames that arrive in one chunk', async () => {
    const frames = await collect(
      parseSseStream(
        chunks(
          'event: token\ndata: {"text":"a"}\n\nevent: token\ndata: {"text":"b"}\n\nevent: done\ndata: {}\n\n',
        ),
      ),
    )

    expect(frames.map(f => f.event)).toEqual(['token', 'token', 'done'])
  })

  it('reassembles a frame that is split across chunks', async () => {
    const frames = await collect(
      parseSseStream(
        chunks('event: tok', 'en\ndata: {"te', 'xt":"Hi"}\n', '\n'),
      ),
    )

    expect(frames).toEqual([{ event: 'token', data: '{"text":"Hi"}' }])
  })

  it('reassembles a multi-byte character that is split across chunks', async () => {
    const bytes = encoder.encode('event: token\ndata: {"text":"360°"}\n\n')
    const cut = bytes.indexOf(0xc2) + 1 // between the two bytes of "°"

    const frames = await collect(
      parseSseStream(chunks(bytes.slice(0, cut), bytes.slice(cut))),
    )

    expect(frames[0].data).toBe('{"text":"360°"}')
  })

  it('accepts Windows line endings', async () => {
    const frames = await collect(
      parseSseStream(chunks('event: done\r\ndata: {}\r\n\r\n')),
    )

    expect(frames).toEqual([{ event: 'done', data: '{}' }])
  })

  it('treats a frame without an event name as "message"', async () => {
    const frames = await collect(parseSseStream(chunks('data: hello\n\n')))

    expect(frames).toEqual([{ event: 'message', data: 'hello' }])
  })

  it('joins multi-line data with a newline', async () => {
    const frames = await collect(
      parseSseStream(chunks('event: x\ndata: one\ndata: two\n\n')),
    )

    expect(frames[0].data).toBe('one\ntwo')
  })

  it('ignores comment lines and unknown fields', async () => {
    const frames = await collect(
      parseSseStream(chunks(': keep-alive\nid: 7\nevent: done\ndata: {}\n\n')),
    )

    expect(frames).toEqual([{ event: 'done', data: '{}' }])
  })

  it('does not emit a frame that never finished', async () => {
    const frames = await collect(
      parseSseStream(chunks('event: token\ndata: {"text":"cut off"')),
    )

    expect(frames).toEqual([])
  })

  it('emits nothing for an empty stream', async () => {
    expect(await collect(parseSseStream(chunks()))).toEqual([])
  })
})
