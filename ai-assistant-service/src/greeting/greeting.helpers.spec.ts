import { Approval } from '../contracts/schemas';
import {
  cleanGreeting,
  countPending,
  fallbackGreeting,
  mentionsCount,
} from './greeting.helpers';

function approval(id: string, status: string): Approval {
  return {
    id,
    title: `Item ${id}`,
    type: 'PDF',
    submittedBy: 'Sam HelpAdmin',
    status,
    submittedDate: 'Sep 18',
  };
}

describe('fallbackGreeting', () => {
  it('says "You have N approvals pending."', () => {
    expect(fallbackGreeting(4)).toBe('You have 4 approvals pending.');
  });

  it('uses the singular for one approval', () => {
    expect(fallbackGreeting(1)).toBe('You have 1 approval pending.');
  });

  it('says there are none when nothing is pending', () => {
    expect(fallbackGreeting(0)).toBe('You have no approvals pending.');
  });
});

describe('countPending', () => {
  it('counts items whose status starts with "Pending"', () => {
    expect(
      countPending([
        approval('a', 'Pending Review'),
        approval('b', 'Approved'),
        approval('c', 'pending review'),
        approval('d', 'Rejected'),
      ]),
    ).toBe(2);
  });

  it('returns 0 for an empty queue', () => {
    expect(countPending([])).toBe(0);
  });
});

describe('mentionsCount', () => {
  it('accepts the number as digits', () => {
    expect(mentionsCount('Good morning! 4 approvals are waiting.', 4)).toBe(
      true,
    );
  });

  it('accepts the number as a word, in any case', () => {
    expect(mentionsCount('You have Four approvals to review.', 4)).toBe(true);
  });

  it('rejects a greeting that leaves the count out', () => {
    expect(mentionsCount('Welcome back! Ready to review?', 4)).toBe(false);
  });

  it('does not match the digit inside a larger number', () => {
    expect(mentionsCount('You have 14 approvals.', 4)).toBe(false);
  });

  it('does not match the word inside another word', () => {
    expect(mentionsCount('Your fourth floor review awaits.', 4)).toBe(false);
  });

  it('accepts "no" or "none" when nothing is pending', () => {
    expect(mentionsCount('All clear, no approvals waiting.', 0)).toBe(true);
    expect(mentionsCount('Nothing is waiting for you.', 0)).toBe(true);
  });
});

describe('mentionsCount with other writing systems', () => {
  it('accepts the count written in native digits', () => {
    expect(mentionsCount('नमस्ते! आपके ४ अनुमोदन लंबित हैं।', 4)).toBe(true); // Devanagari
    expect(mentionsCount('مرحبا! لديك ٤ طلبات', 4)).toBe(true); // Arabic-Indic
    expect(mentionsCount('こんにちは！承認待ちは４件です', 4)).toBe(true); // full-width
  });

  it('accepts ordinary digits next to non-Latin text', () => {
    expect(mentionsCount('आपके अभी 4 मंजूरी वाले पेंडिंग हैं।', 4)).toBe(true);
    expect(mentionsCount('承認待ちが4件あります', 4)).toBe(true);
  });

  it('does not match the count inside a larger number', () => {
    expect(mentionsCount('आपके १४ अनुमोदन लंबित हैं।', 4)).toBe(false);
    expect(mentionsCount('لديك ١٤ طلبات', 4)).toBe(false);
  });

  it('still rejects a greeting without any count', () => {
    expect(mentionsCount('नमस्ते! स्वागत है।', 4)).toBe(false);
  });
});

describe('cleanGreeting', () => {
  it('trims whitespace', () => {
    expect(cleanGreeting('  Hello there!  \n')).toBe('Hello there!');
  });

  it('strips wrapping quotes the model may add', () => {
    expect(cleanGreeting('"Hello there!"')).toBe('Hello there!');
    expect(cleanGreeting('“Hello there!”')).toBe('Hello there!');
  });

  it('keeps quotes that are part of the sentence', () => {
    expect(cleanGreeting('Say "hi" to 4 approvals.')).toBe(
      'Say "hi" to 4 approvals.',
    );
  });

  it('returns an empty string for blank input', () => {
    expect(cleanGreeting('   ')).toBe('');
  });
});
