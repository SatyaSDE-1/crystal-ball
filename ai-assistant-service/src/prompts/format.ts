import { Approval } from '../contracts/schemas';

/** Renders the approvals queue as one readable line per item. */
export function formatApprovals(approvals: Approval[]): string {
  return approvals
    .map(
      (a) =>
        `- [${a.id}] ${a.title} (${a.type}) — submitted by ${a.submittedBy} on ${a.submittedDate}, status: ${a.status}`,
    )
    .join('\n');
}
