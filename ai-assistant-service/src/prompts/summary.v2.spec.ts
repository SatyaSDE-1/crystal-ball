import { Approval } from '../contracts/schemas';
import { summaryPromptV1 } from './summary.v1';
import { summaryPromptV2 } from './summary.v2';

const approvals: Approval[] = [
  {
    id: 'apr-3',
    title: 'Safety Equipment & Sensor Specs',
    type: 'PDF',
    submittedBy: 'Sam HelpAdmin',
    status: 'Pending Review',
    submittedDate: 'Sep 18',
  },
];

describe('summaryPromptV2', () => {
  it('is a new version, and v1 is left as it was', () => {
    expect(summaryPromptV2.version).toBe('v2');
    expect(summaryPromptV1.version).toBe('v1');
  });

  it('keeps the JSON-only contract of v1', () => {
    const system = summaryPromptV2.system.toLowerCase();

    expect(system).toContain('json only');
    for (const field of ['headline', 'items', 'urgency', 'reason', 'source']) {
      expect(system).toContain(field);
    }
  });

  it('tells the model which parts stay in English when it writes another language', () => {
    const system = summaryPromptV2.system;

    expect(system).toMatch(/language/i);
    expect(system).toMatch(/keys/i);
    expect(system).toMatch(/high, medium, low|"high"/);
  });

  it('includes every approval in the user prompt', () => {
    const prompt = summaryPromptV2.buildUserPrompt({ approvals });

    expect(prompt).toContain('apr-3');
    expect(prompt).toContain('Safety Equipment & Sensor Specs');
  });

  it('asks for the operator language when it is not English', () => {
    const prompt = summaryPromptV2.buildUserPrompt({ approvals, locale: 'es' });

    expect(prompt).toContain('Spanish');
    expect(prompt).toContain('apr-3');
  });

  it('adds no language line for English or no locale', () => {
    for (const locale of [undefined, 'en', 'en-US']) {
      const prompt = summaryPromptV2.buildUserPrompt({ approvals, locale });

      expect(prompt).not.toMatch(/language/i);
    }
  });
});
