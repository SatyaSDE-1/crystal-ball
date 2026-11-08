import type { Approval } from '@/types/approvals'

export const approvalFixtures: Approval[] = [
  { title: 'Site Patrol Onboarding & Checklists', type: 'Folder', submitter: 'Sam HelpAdmin', initials: 'SH', color: 'bg-violet-100 text-violet-700', date: 'Sep 18', iconName: 'folder' },
  { title: 'Level 2 Drone Patrol Video Demo', type: 'Video', submitter: 'Alex HelpAdmin', initials: 'AH', color: 'bg-blue-100 text-blue-700', date: 'Sep 18', iconName: 'video' },
  { title: 'Safety Equipment & Sensor Specs', type: 'PDF', submitter: 'Sam HelpAdmin', initials: 'SH', color: 'bg-violet-100 text-violet-700', date: 'Sep 18', iconName: 'file' },
  { title: '360° Spatial Zone Layout & Camera Map', type: 'Image', submitter: 'Elena HelpAdmin', initials: 'EH', color: 'bg-amber-100 text-amber-700', date: 'Sep 18', iconName: 'image' },
]
