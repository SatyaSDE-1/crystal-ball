import { Approval } from '../contracts/schemas';

const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
];

/** Items still waiting on a reviewer. */
export function countPending(approvals: Approval[]): number {
  return approvals.filter((a) => a.status.toLowerCase().startsWith('pending'))
    .length;
}

/** Deterministic greeting used whenever the LLM cannot be trusted. */
export function fallbackGreeting(count: number): string {
  if (count === 0) {
    return 'You have no approvals pending.';
  }
  const noun = count === 1 ? 'approval' : 'approvals';
  return `You have ${count} ${noun} pending.`;
}

/**
 * A context-aware greeting must actually reference the pending count,
 * as digits ("4") or as a word ("four").
 */
export function mentionsCount(text: string, count: number): boolean {
  const lower = text.toLowerCase();
  const patterns = [`\\b${count}\\b`];

  if (count < NUMBER_WORDS.length) {
    patterns.push(`\\b${NUMBER_WORDS[count]}\\b`);
  }
  if (count === 0) {
    patterns.push('\\bno\\b', '\\bnone\\b', '\\bnothing\\b');
  }

  return patterns.some((pattern) => new RegExp(pattern).test(lower));
}

/** Models sometimes wrap the greeting in quotes despite being told not to. */
export function cleanGreeting(raw: string): string {
  const text = raw.trim();
  const wrapped = /^["“”]([\s\S]*)["“”]$/.exec(text);
  return wrapped ? wrapped[1].trim() : text;
}
