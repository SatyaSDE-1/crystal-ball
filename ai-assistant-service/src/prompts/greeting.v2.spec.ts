import { greetingPromptV1 } from './greeting.v1';
import { greetingPromptV2 } from './greeting.v2';

describe('greetingPromptV2', () => {
  it('is a new version, and v1 is left as it was', () => {
    expect(greetingPromptV2.version).toBe('v2');
    expect(greetingPromptV1.version).toBe('v1');
  });

  it('still asks for a short greeting with fresh wording', () => {
    const system = greetingPromptV2.system.toLowerCase();

    expect(system).toContain('short');
    expect(system).toContain('different');
  });

  it('asks for the pending count as digits, so it can be checked in any language', () => {
    expect(greetingPromptV2.system).toMatch(/digits/i);
  });

  it('includes the pending count in the user prompt', () => {
    expect(greetingPromptV2.buildUserPrompt({ pendingCount: 4 })).toContain(
      '4',
    );
    expect(greetingPromptV2.buildUserPrompt({ pendingCount: 11 })).toContain(
      '11',
    );
  });

  it('asks for the operator language when it is not English', () => {
    const prompt = greetingPromptV2.buildUserPrompt({
      pendingCount: 4,
      locale: 'hi-IN',
    });

    expect(prompt).toContain('Hindi');
    expect(prompt).toContain('4');
  });

  it('adds no language line for English or no locale', () => {
    for (const locale of [undefined, 'en', 'en-GB']) {
      expect(
        greetingPromptV2.buildUserPrompt({ pendingCount: 4, locale }),
      ).not.toMatch(/language/i);
    }
  });
});
