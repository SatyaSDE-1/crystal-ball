import { greetingPromptV1 } from './greeting.v1';

describe('greetingPromptV1', () => {
  it('is versioned', () => {
    expect(greetingPromptV1.version).toBe('v1');
  });

  it('asks for a short greeting with fresh wording each time', () => {
    const system = greetingPromptV1.system.toLowerCase();

    expect(system).toContain('short');
    expect(system).toContain('different');
  });

  it('includes the pending count in the user prompt', () => {
    const prompt = greetingPromptV1.buildUserPrompt({ pendingCount: 4 });

    expect(prompt).toContain('4');
  });

  it('reflects a different pending count', () => {
    const prompt = greetingPromptV1.buildUserPrompt({ pendingCount: 11 });

    expect(prompt).toContain('11');
  });
});
