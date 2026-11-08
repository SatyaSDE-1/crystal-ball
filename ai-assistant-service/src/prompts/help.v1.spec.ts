import { helpPromptV1 } from './help.v1';

const chunks = [
  {
    id: 'rejection-criteria',
    heading: 'Rejection Criteria',
    text: 'Reject an item when the file is corrupt or cannot be opened.',
  },
  {
    id: 'sla',
    heading: 'SLA',
    text: 'Standard items are reviewed within two business days.',
  },
];

describe('helpPromptV1', () => {
  it('is versioned', () => {
    expect(helpPromptV1.version).toBe('v1');
  });

  it('restricts answers to the provided context and defines the not-covered reply', () => {
    const system = helpPromptV1.system;

    expect(system.toLowerCase()).toContain('only');
    expect(system).toContain('Not covered in the policy note');
  });

  it('includes the question and every chunk passed in the user prompt', () => {
    const prompt = helpPromptV1.buildUserPrompt({
      question: 'What are the rejection criteria?',
      chunks,
    });

    expect(prompt).toContain('What are the rejection criteria?');
    for (const chunk of chunks) {
      expect(prompt).toContain(chunk.id);
      expect(prompt).toContain(chunk.text);
    }
  });

  it('does not leak chunks that were not passed in', () => {
    const prompt = helpPromptV1.buildUserPrompt({
      question: 'How fast are reviews?',
      chunks: [chunks[1]],
    });

    expect(prompt).toContain('two business days');
    expect(prompt).not.toContain('corrupt');
  });
});
