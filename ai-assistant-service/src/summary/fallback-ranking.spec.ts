import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Approval, SummaryResponse } from '../contracts/schemas';
import { rankApprovals } from './fallback-ranking';

const approvals = JSON.parse(
  readFileSync(join(__dirname, '../data/approvals.json'), 'utf-8'),
) as Approval[];

describe('rankApprovals (deterministic fallback)', () => {
  it('returns a valid SummaryResponse with source "fallback"', () => {
    const result = rankApprovals(approvals);

    expect(SummaryResponse.safeParse(result).success).toBe(true);
    expect(result.source).toBe('fallback');
  });

  it('ranks safety-critical content first, then operational, then media', () => {
    const result = rankApprovals(approvals);

    expect(result.items.map((i) => [i.id, i.urgency])).toEqual([
      ['apr-3', 'high'], // Safety Equipment & Sensor Specs (PDF)
      ['apr-1', 'medium'], // Site Patrol Onboarding & Checklists (Folder)
      ['apr-4', 'medium'], // 360° Spatial Zone Layout & Camera Map (Image)
      ['apr-2', 'low'], // Level 2 Drone Patrol Video Demo (Video)
    ]);
  });

  it('includes every approval exactly once with a reason', () => {
    const result = rankApprovals(approvals);

    expect(result.items.map((i) => i.id).sort()).toEqual([
      'apr-1',
      'apr-2',
      'apr-3',
      'apr-4',
    ]);
    for (const item of result.items) {
      expect(item.reason.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic: the same input gives the same output', () => {
    expect(rankApprovals(approvals)).toEqual(rankApprovals(approvals));
  });

  it('keeps the original order among items of equal urgency', () => {
    const [onboarding, , , layout] = approvals;
    const result = rankApprovals([layout, onboarding]);

    expect(result.items.map((i) => i.id)).toEqual([layout.id, onboarding.id]);
  });

  it('does not mutate its input', () => {
    const copy = structuredClone(approvals);

    rankApprovals(copy);

    expect(copy).toEqual(approvals);
  });

  it('mentions the pending count and the high-priority count in the headline', () => {
    const { headline } = rankApprovals(approvals);

    expect(headline).toContain('4 approvals');
    expect(headline).toContain('1 high priority');
  });

  it('handles an empty queue', () => {
    const result = rankApprovals([]);

    expect(result.items).toEqual([]);
    expect(result.headline).toBe('No approvals pending review.');
    expect(SummaryResponse.safeParse(result).success).toBe(true);
  });
});
