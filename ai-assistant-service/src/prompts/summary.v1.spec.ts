import { Approval } from '../contracts/schemas';
import { summaryPromptV1 } from './summary.v1';

const approvals: Approval[] = [
  {
    id: 'apr-3',
    title: 'Safety Equipment & Sensor Specs',
    type: 'PDF',
    submittedBy: 'Sam HelpAdmin',
    status: 'Pending Review',
    submittedDate: 'Sep 18',
  },
  {
    id: 'apr-2',
    title: 'Level 2 Drone Patrol Video Demo',
    type: 'Video',
    submittedBy: 'Alex HelpAdmin',
    status: 'Pending Review',
    submittedDate: 'Sep 18',
  },
];

describe('summaryPromptV1', () => {
  it('is versioned', () => {
    expect(summaryPromptV1.version).toBe('v1');
  });

  it('asks for JSON-only output with the SummaryResponse fields', () => {
    const system = summaryPromptV1.system.toLowerCase();

    expect(system).toContain('json');
    expect(system).toContain('only');
    for (const field of ['headline', 'items', 'urgency', 'reason', 'source']) {
      expect(system).toContain(field);
    }
  });

  it('includes every approval passed in the user prompt', () => {
    const prompt = summaryPromptV1.buildUserPrompt({ approvals });

    for (const approval of approvals) {
      expect(prompt).toContain(approval.id);
      expect(prompt).toContain(approval.title);
      expect(prompt).toContain(approval.submittedBy);
    }
  });
});
