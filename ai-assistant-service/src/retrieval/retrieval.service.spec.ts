import { RetrievalService, tokenize } from './retrieval.service';

describe('tokenize', () => {
  it('drops stopwords, short words and punctuation', () => {
    expect(tokenize('What is the?')).toEqual([]);
    expect(tokenize('A to of in!')).toEqual([]);
  });

  it('is case-insensitive', () => {
    expect(tokenize('SLA')).toEqual(tokenize('sla'));
  });

  it('treats simple word forms as the same word', () => {
    expect(tokenize('rejected')).toEqual(tokenize('rejection'));
    expect(tokenize('reviews')).toEqual(tokenize('review'));
    expect(tokenize('escalating')).toEqual(tokenize('escalation'));
  });

  it('returns each word once', () => {
    expect(tokenize('safety safety safety')).toHaveLength(1);
  });
});

describe('RetrievalService', () => {
  const service = new RetrievalService();

  it('loads the 5 policy chunks', () => {
    expect(service.getChunks().map((c) => c.id)).toEqual([
      'review-order',
      'rejection-criteria',
      'escalation',
      'file-type-rules',
      'sla',
    ]);
  });

  it('returns the rejection criteria chunk first for a rejection question', () => {
    const [top] = service.retrieve('What are the rejection criteria?');

    expect(top.id).toBe('rejection-criteria');
  });

  it('returns at most 2 chunks by default', () => {
    expect(
      service.retrieve('How do I review and escalate a PDF?').length,
    ).toBeLessThanOrEqual(2);
  });

  it('respects an explicit limit', () => {
    expect(service.retrieve('review escalation SLA PDF', 1)).toHaveLength(1);
    expect(
      service.retrieve('review escalation SLA PDF', 3).length,
    ).toBeLessThanOrEqual(3);
  });

  it('finds the file-type rules for a question about PDFs', () => {
    const ids = service.retrieve('How do I review a PDF?').map((c) => c.id);

    expect(ids).toContain('file-type-rules');
  });

  it('finds the SLA chunk for a question about deadlines', () => {
    const [top] = service.retrieve('What is the SLA for standard items?');

    expect(top.id).toBe('sla');
  });

  it('matches different word forms ("escalating" finds Escalation)', () => {
    const [top] = service.retrieve('Who should I be escalating things to?');

    expect(top.id).toBe('escalation');
  });

  it('returns [] for an unrelated question', () => {
    expect(service.retrieve('What is the capital of France?')).toEqual([]);
  });

  it('returns [] for an empty or stopword-only query', () => {
    expect(service.retrieve('')).toEqual([]);
    expect(service.retrieve('what is the')).toEqual([]);
  });

  it('is deterministic', () => {
    const question = 'How long do reviews take?';

    expect(service.retrieve(question)).toEqual(service.retrieve(question));
  });

  it('returns whole chunks with id, heading and text', () => {
    const [top] = service.retrieve('rejection criteria');

    expect(top).toEqual({
      id: 'rejection-criteria',
      heading: 'Rejection Criteria',
      text: expect.stringContaining('corrupt') as string,
    });
  });
});
