import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chunkPolicy } from './chunk-policy';

describe('chunkPolicy', () => {
  it('splits markdown into one chunk per ## heading', () => {
    const chunks = chunkPolicy(
      '# Title\n\n## First Part\n\nAlpha text.\n\n## Second Part\n\nBeta text.\n',
    );

    expect(chunks).toEqual([
      { id: 'first-part', heading: 'First Part', text: 'Alpha text.' },
      { id: 'second-part', heading: 'Second Part', text: 'Beta text.' },
    ]);
  });

  it('ignores the top-level title and any text before the first ## heading', () => {
    const chunks = chunkPolicy('# Title\n\nIntro line.\n\n## Only\n\nBody.');

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('Body.');
  });

  it('keeps multi-line bodies together and trims whitespace', () => {
    const chunks = chunkPolicy('## A\n\n  line one\nline two  \n\n');

    expect(chunks[0].text).toBe('line one\nline two');
  });

  it('makes URL-safe ids from headings', () => {
    const [chunk] = chunkPolicy('## File-Type Rules & More!\n\nBody.');

    expect(chunk.id).toBe('file-type-rules-more');
  });

  it('returns no chunks for markdown without ## headings', () => {
    expect(chunkPolicy('# Only a title\n\nSome text.')).toEqual([]);
    expect(chunkPolicy('')).toEqual([]);
  });

  it('splits the real policy note into its 5 sections', () => {
    const markdown = readFileSync(
      join(__dirname, '../data/policy.md'),
      'utf-8',
    );

    const chunks = chunkPolicy(markdown);

    expect(chunks.map((c) => c.id)).toEqual([
      'review-order',
      'rejection-criteria',
      'escalation',
      'file-type-rules',
      'sla',
    ]);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeGreaterThan(20);
    }
  });
});
