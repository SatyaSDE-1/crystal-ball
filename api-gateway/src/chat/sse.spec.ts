import { formatSseEvent } from './sse';

describe('formatSseEvent', () => {
  it('formats a token event', () => {
    expect(formatSseEvent({ type: 'token', text: 'Hi' })).toBe(
      'event: token\ndata: {"text":"Hi"}\n\n',
    );
  });

  it('formats a done event', () => {
    expect(formatSseEvent({ type: 'done' })).toBe('event: done\ndata: {}\n\n');
  });

  it('formats an error event', () => {
    expect(formatSseEvent({ type: 'error', message: 'Try again.' })).toBe(
      'event: error\ndata: {"message":"Try again."}\n\n',
    );
  });

  it('keeps a token with line breaks on a single data line', () => {
    const frame = formatSseEvent({ type: 'token', text: 'line one\nline two' });

    expect(frame).toBe(
      'event: token\ndata: {"text":"line one\\nline two"}\n\n',
    );
    // Exactly one blank line (the frame terminator): no stray breaks inside.
    expect(frame.match(/\n\n/g)).toHaveLength(1);
  });
});
