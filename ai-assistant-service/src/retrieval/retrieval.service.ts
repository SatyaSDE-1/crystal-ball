import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PolicyChunk } from '../prompts/types';
import { chunkPolicy } from './chunk-policy';

const DEFAULT_LIMIT = 2;

const HEADING_WEIGHT = 3;
const BODY_WEIGHT = 1;

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'what',
  'when',
  'where',
  'which',
  'who',
  'whom',
  'how',
  'why',
  'are',
  'was',
  'were',
  'can',
  'could',
  'should',
  'would',
  'does',
  'did',
  'you',
  'your',
  'have',
  'has',
  'had',
  'from',
  'into',
  'about',
  'there',
  'their',
  'they',
  'them',
  'any',
  'all',
  'not',
  'but',
  'than',
  'then',
  'too',
  'very',
  'policy',
  'note',
]);


function stem(word: string): string {
  let result = word;
  for (const suffix of ['ions', 'ion', 'ing', 'ed', 'es', 's']) {
    if (result.endsWith(suffix) && result.length - suffix.length >= 4) {
      result = result.slice(0, -suffix.length);
      break;
    }
  }
  if (result.length > 4 && result.endsWith('e')) {
    result = result.slice(0, -1);
  }
  return result;
}


export function tokenize(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const keywords = words
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word))
    .map(stem);
  return [...new Set(keywords)];
}

interface IndexedChunk {
  chunk: PolicyChunk;
  headingTokens: Set<string>;
  bodyTokens: Set<string>;
}


@Injectable()
export class RetrievalService {
  private readonly indexed: IndexedChunk[];

  constructor() {
    const markdown = readFileSync(
      join(__dirname, '../data/policy.md'),
      'utf-8',
    );
    this.indexed = chunkPolicy(markdown).map((chunk) => ({
      chunk,
      headingTokens: new Set(tokenize(chunk.heading)),
      bodyTokens: new Set(tokenize(chunk.text)),
    }));
  }

  getChunks(): PolicyChunk[] {
    return this.indexed.map(({ chunk }) => ({ ...chunk }));
  }

  /** Top chunks for the query, best first; [] when nothing is relevant. */
  retrieve(query: string, limit = DEFAULT_LIMIT): PolicyChunk[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
      return [];
    }

    const rarity = new Map<string, number>(
      queryTokens.map((token) => {
        const containing = this.indexed.filter(
          ({ headingTokens, bodyTokens }) =>
            headingTokens.has(token) || bodyTokens.has(token),
        ).length;
        return [
          token,
          Math.log(1 + this.indexed.length / Math.max(containing, 1)),
        ];
      }),
    );

    return this.indexed
      .map(({ chunk, headingTokens, bodyTokens }, index) => {
        let score = 0;
        for (const token of queryTokens) {
          const weight =
            (headingTokens.has(token) ? HEADING_WEIGHT : 0) +
            (bodyTokens.has(token) ? BODY_WEIGHT : 0);
          score += weight * (rarity.get(token) ?? 0);
        }
        return { chunk, score, index };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, limit)
      .map(({ chunk }) => ({ ...chunk }));
  }
}
