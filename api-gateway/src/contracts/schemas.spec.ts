import { ChatRequest, HelpRequest, LocaleRequest } from './schemas';

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

describe('LocaleRequest (summary and greeting take no input, except the language)', () => {
  it('accepts an empty object', () => {
    expect(LocaleRequest.safeParse({}).success).toBe(true);
  });

  it('accepts a missing body', () => {
    expect(LocaleRequest.safeParse(undefined).success).toBe(true);
  });

  it('accepts language codes with and without a region', () => {
    for (const locale of ['en', 'es', 'hi-IN', 'pt-BR', 'zh-Hant-TW']) {
      expect(LocaleRequest.parse({ locale })).toEqual({ locale });
    }
  });

  it('rejects anything that is not a language code', () => {
    for (const locale of [
      '',
      'x',
      'english please',
      'es;drop table',
      'a'.repeat(40),
      42,
    ]) {
      expect(LocaleRequest.safeParse({ locale }).success).toBe(false);
    }
  });

  it('drops any other field sent along', () => {
    expect(LocaleRequest.parse({ locale: 'es', anything: 'ignored' })).toEqual({
      locale: 'es',
    });
    expect(LocaleRequest.parse({ anything: 'ignored' })).toEqual({});
  });

  it('rejects a body that is not an object', () => {
    expect(LocaleRequest.safeParse('hello').success).toBe(false);
    expect(LocaleRequest.safeParse([1, 2]).success).toBe(false);
    expect(LocaleRequest.safeParse(null).success).toBe(false);
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
