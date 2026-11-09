import { Approval } from '../contracts/schemas';
import { ApprovalsService } from './approvals.service';

describe('ApprovalsService', () => {
  const service = new ApprovalsService();

  it('returns the 4 fixture approvals', () => {
    expect(service.getApprovals()).toHaveLength(4);
  });

  it('returns items that satisfy the Approval contract', () => {
    for (const approval of service.getApprovals()) {
      expect(Approval.safeParse(approval).success).toBe(true);
    }
  });

  it('returns the expected titles', () => {
    expect(service.getApprovals().map((a) => a.title)).toEqual([
      'Site Patrol Onboarding & Checklists',
      'Level 2 Drone Patrol Video Demo',
      'Safety Equipment & Sensor Specs',
      '360° Spatial Zone Layout & Camera Map',
    ]);
  });

  it('does not let callers mutate the stored fixtures', () => {
    service.getApprovals()[0].title = 'tampered';

    expect(service.getApprovals()[0].title).toBe(
      'Site Patrol Onboarding & Checklists',
    );
  });
});
