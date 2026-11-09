import { FileImage, FileText, Folder, Video, type LucideProps } from 'lucide-react'
import type { Approval } from '@/types/approvals'

const ICONS = { folder: Folder, video: Video, file: FileText, image: FileImage }

/**
 * Components cannot cross from a server component to a client component as
 * props, so approvals carry a plain `iconName` and the client picks the icon.
 */
export function ApprovalIcon({ name, ...props }: { name: Approval['iconName'] } & LucideProps) {
  const Icon = ICONS[name]
  return <Icon {...props} />
}
