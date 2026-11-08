import { Approval } from '../contracts/schemas';
import { chatTalkPromptV1 } from './chat-talk.v1';

const approvals: Approval[] = [
  {
    id: 'apr-1',
    title: 'Site Patrol Onboarding & Checklists',
    type: 'Folder',
    submittedBy: 'Sam HelpAdmin',
    status: 'Pending Review',
    submittedDate: 'Sep 18',
  },
];

describe('chatTalkPromptV1', () => {
  it('is versioned', () => {
    expect(chatTalkPromptV1.version).toBe('v1');
  });

  it('has a system prompt that keeps the assistant on the approvals queue', () => {
    expect(chatTalkPromptV1.system.toLowerCase()).toContain('approvals');
  });

  it('includes the approvals and the operator question in the user prompt', () => {
    const prompt = chatTalkPromptV1.buildUserPrompt({
      approvals,
      question: 'Which approval needs my attention first and why?',
    });

    expect(prompt).toContain('Site Patrol Onboarding & Checklists');
    expect(prompt).toContain('Sam HelpAdmin');
    expect(prompt).toContain(
      'Which approval needs my attention first and why?',
    );
  });
});
