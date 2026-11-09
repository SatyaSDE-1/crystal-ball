import type { ReactNode } from 'react'

/**
 * Renders model text without ever treating it as HTML. Only React text nodes
 * are produced, so markup in the text is shown as plain characters. It
 * understands the little the assistant uses: **bold**, "- " bullets and
 * "1." numbered lists.
 */

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*)/g).filter(Boolean).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : part,
  )
}

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }

function toBlocks(text: string): Block[] {
  const blocks: Block[] = []

  for (const line of text.split('\n')) {
    if (line.trim() === '') continue

    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    const item = bullet ?? numbered
    const kind = bullet ? 'ul' : 'ol'

    const last = blocks[blocks.length - 1]
    if (item) {
      if (last && last.kind === kind) last.items.push(item[1])
      else blocks.push({ kind, items: [item[1]] })
    } else {
      blocks.push({ kind: 'p', text: line.trim() })
    }
  }
  return blocks
}

export function RichText({ text }: { text: string }) {
  return <>{toBlocks(text).map((block, index) => {
    if (block.kind === 'p') return <p key={index}>{inline(block.text)}</p>
    const Tag = block.kind
    return <Tag key={index}>{block.items.map((item, i) => <li key={i}>{inline(item)}</li>)}</Tag>
  })}</>
}
