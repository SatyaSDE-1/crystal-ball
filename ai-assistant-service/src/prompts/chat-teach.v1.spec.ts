import { Approval } from '../contracts/schemas';
import { chatTeachPromptV1 } from './chat-teach.v1';

const approvals: Approval[] = [
  {
    id: 'apr-3',
    title: 'Safety Equipment & Sensor Specs',
    type: 'PDF',
    submittedBy: 'Sam HelpAdmin',
    status: 'Pending Review',
    submittedDate: 'Sep 18',
  },
];

describe('chatTeachPromptV1', () => {
  it('is versioned', () => {
    expect(chatTeachPromptV1.version).toBe('v1');
  });

  it('asks for step-by-step teaching that adapts to follow-ups', () => {
    const system = chatTeachPromptV1.system.toLowerCase();

    expect(system).toContain('step');
    expect(system).toContain('follow-up');
  });

  it('includes the approvals and the operator question in the user prompt', () => {
    const prompt = chatTeachPromptV1.buildUserPrompt({
      approvals,
      question: 'How do I review a PDF?',
    });

    expect(prompt).toContain('Safety Equipment & Sensor Specs');
    expect(prompt).toContain('PDF');
    expect(prompt).toContain('How do I review a PDF?');
  });
});
