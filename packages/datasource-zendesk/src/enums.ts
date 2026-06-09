export const TICKET_STATUSES = ['new', 'open', 'pending', 'hold', 'solved', 'closed'] as const;
export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const TICKET_TYPES = ['problem', 'incident', 'question', 'task'] as const;
export const USER_ROLES = ['end-user', 'agent', 'admin'] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketType = (typeof TICKET_TYPES)[number];
export type UserRole = (typeof USER_ROLES)[number];

export const CLOSEABLE_STATUSES: ReadonlyArray<Extract<TicketStatus, 'solved' | 'closed'>> = [
  'solved',
  'closed',
];
