import { PolicyChunk } from '../prompts/types';

/** "File-Type Rules & More!" -> "file-type-rules-more" */
function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Splits the policy note into one chunk per "## " heading. The "# " title
 * and any text before the first "## " heading are not part of a chunk. The
 * chunk id is the slugified heading, and is what answers cite.
 */
export function chunkPolicy(markdown: string): PolicyChunk[] {
  const chunks: { heading: string; lines: string[] }[] = [];

  for (const line of markdown.split('\n')) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      chunks.push({ heading: heading[1], lines: [] });
    } else if (chunks.length > 0) {
      chunks[chunks.length - 1].lines.push(line);
    }
  }

  return chunks.map(({ heading, lines }) => ({
    id: slugify(heading),
    heading,
    text: lines.join('\n').trim(),
  }));
}
