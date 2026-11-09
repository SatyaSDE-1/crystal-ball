import { Approval, SummaryResponse } from '../contracts/schemas';

type Urgency = SummaryResponse['items'][number]['urgency'];

/**
 * Deterministic fallback ranking, used whenever the LLM is unavailable or
 * returns something we cannot trust. No randomness, no model: the same
 * queue always gives the same summary.
 *
 * RULE (first match wins):
 *   1. high   - the title mentions "safety", "spec" or "sensor"
 *               (safety documents and equipment/sensor specifications)
 *   2. medium - the type is Folder or Image
 *               (operational content: onboarding material, zone layouts)
 *   3. low    - everything else (training and demo media such as Video)
 *
 * Items are ordered high -> medium -> low. Items of equal urgency keep their
 * original queue order, so the output is stable.
 */
const SAFETY_CRITICAL = /safety|spec|sensor/i;
const OPERATIONAL_TYPES: ReadonlySet<Approval['type']> = new Set([
  'Folder',
  'Image',
]);

const URGENCY_RANK: Record<Urgency, number> = { high: 0, medium: 1, low: 2 };

function urgencyOf(approval: Approval): Urgency {
  if (SAFETY_CRITICAL.test(approval.title)) {
    return 'high';
  }
  if (OPERATIONAL_TYPES.has(approval.type)) {
    return 'medium';
  }
  return 'low';
}

function reasonFor(approval: Approval, urgency: Urgency): string {
  const type = approval.type.toLowerCase();
  switch (urgency) {
    case 'high':
      return `Safety-critical ${type} from ${approval.submittedBy}; review first.`;
    case 'medium':
      return `Operational ${type} from ${approval.submittedBy}; review next.`;
    case 'low':
      return `Training or demo ${type} from ${approval.submittedBy}; review once the rest is clear.`;
  }
}

function headlineFor(total: number, high: number): string {
  if (total === 0) {
    return 'No approvals pending review.';
  }
  const noun = total === 1 ? 'approval' : 'approvals';
  return `${total} ${noun} pending review; ${high} high priority.`;
}

export function rankApprovals(approvals: Approval[]): SummaryResponse {
  const ranked = approvals
    .map((approval, index) => ({
      approval,
      index,
      urgency: urgencyOf(approval),
    }))
    .sort(
      (a, b) =>
        URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || a.index - b.index,
    );

  const high = ranked.filter((r) => r.urgency === 'high').length;

  return {
    headline: headlineFor(approvals.length, high),
    items: ranked.map(({ approval, urgency }) => ({
      id: approval.id,
      urgency,
      reason: reasonFor(approval, urgency),
    })),
    source: 'fallback',
  };
}
