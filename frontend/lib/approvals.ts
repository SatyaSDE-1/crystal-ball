import type { ApiApproval, Approval, ApprovalStats, ApprovalType } from '@/types/approvals'

const PALETTE = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
]

const ICON_BY_TYPE: Record<ApprovalType, Approval['iconName']> = {
  Folder: 'folder',
  Video: 'video',
  PDF: 'file',
  Image: 'image',
}

const TYPES = new Set<string>(Object.keys(ICON_BY_TYPE))

/** "Sam HelpAdmin" -> "SH" */
export function initialsOf(name: string): string {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]?.toUpperCase() ?? '')
  return letters.join('') || '?'
}

/** Narrow unknown JSON to the approvals we can render; anything malformed is dropped. */
export function parseApiApprovals(data: unknown): ApiApproval[] {
  if (!Array.isArray(data)) throw new Error('Expected an array of approvals')

  const valid = data.filter((item): item is ApiApproval => {
    if (typeof item !== 'object' || item === null) return false
    const row = item as Record<string, unknown>
    return (
      typeof row.id === 'string' &&
      typeof row.title === 'string' &&
      typeof row.type === 'string' && TYPES.has(row.type) &&
      typeof row.submittedBy === 'string' &&
      typeof row.status === 'string' &&
      typeof row.submittedDate === 'string'
    )
  })

  if (data.length > 0 && valid.length === 0) throw new Error('No approval had the expected shape')
  return valid
}

/** Backend shape -> UI shape. Each submitter keeps one colour, in order of first appearance. */
export function toApprovals(items: ApiApproval[]): Approval[] {
  const colours = new Map<string, string>()

  return items.map(item => {
    if (!colours.has(item.submittedBy)) {
      colours.set(item.submittedBy, PALETTE[colours.size % PALETTE.length])
    }
    return {
      id: item.id,
      title: item.title,
      type: item.type,
      submitter: item.submittedBy,
      initials: initialsOf(item.submittedBy),
      color: colours.get(item.submittedBy) as string,
      date: item.submittedDate,
      status: item.status,
      iconName: ICON_BY_TYPE[item.type],
    }
  })
}

export function statsOf(approvals: Approval[]): ApprovalStats {
  const count = (prefix: string) =>
    approvals.filter(a => a.status.toLowerCase().startsWith(prefix)).length

  return {
    total: approvals.length,
    pending: count('pending'),
    approved: count('approved'),
    rejected: count('rejected'),
  }
}
