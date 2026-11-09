import { resolveTracker } from './tracker';

describe('resolveTracker', () => {
  it('keys by the x-session-id header', () => {
    expect(
      resolveTracker({
        headers: { 'x-session-id': 'test-1' },
        ip: '127.0.0.1',
      }),
    ).toBe('session:test-1');
  });

  it('trims whitespace around the session id', () => {
    expect(
      resolveTracker({ headers: { 'x-session-id': '  test-1  ' }, ip: '::1' }),
    ).toBe('session:test-1');
  });

  it('falls back to the IP when the header is missing', () => {
    expect(resolveTracker({ headers: {}, ip: '203.0.113.7' })).toBe(
      'ip:203.0.113.7',
    );
  });

  it('falls back to the IP when the header is blank', () => {
    expect(
      resolveTracker({ headers: { 'x-session-id': '   ' }, ip: '203.0.113.7' }),
    ).toBe('ip:203.0.113.7');
  });

  it('uses the first value when the header arrives as an array', () => {
    expect(
      resolveTracker({
        headers: { 'x-session-id': ['first', 'second'] },
        ip: '127.0.0.1',
      }),
    ).toBe('session:first');
  });

  it('never mixes a session id with an IP that looks the same', () => {
    const bySession = resolveTracker({
      headers: { 'x-session-id': '127.0.0.1' },
      ip: '10.0.0.1',
    });
    const byIp = resolveTracker({ headers: {}, ip: '127.0.0.1' });

    expect(bySession).not.toBe(byIp);
  });

  it('still returns a stable key when there is no header and no IP', () => {
    expect(resolveTracker({ headers: {} })).toBe('ip:unknown');
  });
});
