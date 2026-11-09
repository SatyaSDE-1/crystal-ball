import { parseSummary } from './summary.parser';

const valid = {
  headline: 'Four approvals await review.',
  items: [{ id: 'apr-3', urgency: 'high', reason: 'Safety specs.' }],
  source: 'ai',
};

describe('parseSummary', () => {
  it('parses plain JSON', () => {
    expect(parseSummary(JSON.stringify(valid))).toEqual(valid);
  });

  it('strips ```json code fences', () => {
    const raw = '```json\n' + JSON.stringify(valid) + '\n```';

    expect(parseSummary(raw)).toEqual(valid);
  });

  it('strips bare ``` code fences', () => {
    const raw = '```\n' + JSON.stringify(valid) + '\n```';

    expect(parseSummary(raw)).toEqual(valid);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseSummary('\n  ' + JSON.stringify(valid) + '  \n')).toEqual(
      valid,
    );
  });

  it('returns null for malformed JSON', () => {
    expect(parseSummary('{"headline": "oops", ')).toBeNull();
  });

  it('returns null for prose that is not JSON', () => {
    expect(parseSummary('Here is your summary: all good!')).toBeNull();
  });

  it('returns null for an invalid urgency', () => {
    const invalid = {
      ...valid,
      items: [{ id: 'apr-3', urgency: 'critical', reason: 'x' }],
    };

    expect(parseSummary(JSON.stringify(invalid))).toBeNull();
  });

  it('returns null when a required field is missing', () => {
    const withoutHeadline = { items: valid.items, source: valid.source };

    expect(parseSummary(JSON.stringify(withoutHeadline))).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseSummary('')).toBeNull();
  });
});
