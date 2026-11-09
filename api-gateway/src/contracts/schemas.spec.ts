import { ChatRequest, EmptyRequest, HelpRequest } from './schemas';

describe('HelpRequest', () => {
  it('accepts a question of 3 or more characters', () => {
    expect(
      HelpRequest.safeParse({ question: 'What is the SLA?' }).success,
    ).toBe(true);
  });

  it('rejects a short, missing or non-string question', () => {
    expect(HelpRequest.safeParse({ question: 'hi' }).success).toBe(false);
    expect(HelpRequest.safeParse({}).success).toBe(false);
    expect(HelpRequest.safeParse({ question: 42 }).success).toBe(false);
  });
});

describe('EmptyRequest (summary and greeting take no input)', () => {
  it('accepts an empty object', () => {
    expect(EmptyRequest.safeParse({}).success).toBe(true);
  });

  it('accepts a missing body', () => {
    expect(EmptyRequest.safeParse(undefined).success).toBe(true);
  });

  it('drops any fields sent along', () => {
    expect(EmptyRequest.parse({ anything: 'ignored' })).toEqual({});
  });

  it('rejects a body that is not an object', () => {
    expect(EmptyRequest.safeParse('hello').success).toBe(false);
    expect(EmptyRequest.safeParse([1, 2]).success).toBe(false);
    expect(EmptyRequest.safeParse(null).success).toBe(false);
  });
});

describe('ChatRequest (gateway copy)', () => {
  it('still requires the last message to be from the user', () => {
    const request = {
      sessionId: 's',
      mode: 'talk',
      messages: [{ role: 'assistant', content: 'Hello' }],
    };

    expect(ChatRequest.safeParse(request).success).toBe(false);
  });
});
