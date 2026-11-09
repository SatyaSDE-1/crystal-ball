import type { Approval } from '@/types/approvals'

/** Sample data, used only when the API cannot be reached. */
export const approvalFixtures: Approval[] = [
  { id: 'apr-1', title: 'Site Patrol Onboarding & Checklists', type: 'Folder', submitter: 'Sam HelpAdmin', initials: 'SH', color: 'bg-violet-100 text-violet-700', date: 'Sep 18', status: 'Pending Review', iconName: 'folder' },
  { id: 'apr-2', title: 'Level 2 Drone Patrol Video Demo', type: 'Video', submitter: 'Alex HelpAdmin', initials: 'AH', color: 'bg-blue-100 text-blue-700', date: 'Sep 18', status: 'Pending Review', iconName: 'video' },
  { id: 'apr-3', title: 'Safety Equipment & Sensor Specs', type: 'PDF', submitter: 'Sam HelpAdmin', initials: 'SH', color: 'bg-violet-100 text-violet-700', date: 'Sep 18', status: 'Pending Review', iconName: 'file' },
  { id: 'apr-4', title: '360° Spatial Zone Layout & Camera Map', type: 'Image', submitter: 'Elena HelpAdmin', initials: 'EH', color: 'bg-amber-100 text-amber-700', date: 'Sep 18', status: 'Pending Review', iconName: 'image' },
]
