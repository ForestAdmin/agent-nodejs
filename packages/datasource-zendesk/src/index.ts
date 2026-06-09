export { createZendeskDataSource } from './factory';
export type { ZendeskDataSourceOptions } from './factory';
export { default as ZendeskDataSource, COLLECTION_NAMES } from './datasource';
export { createZendeskClient, ZendeskHttpClient, MAX_PER_PAGE, MAX_TOTAL_RESULTS } from './client';
export type { ZendeskClient, RawCustomFieldDefinition } from './client';
export { closeTicketPlugin } from './plugins/close-ticket';
export type { CloseTicketOptions } from './plugins/close-ticket';
export { createTicketWithNotificationPlugin } from './plugins/create-ticket-with-notification';
export type {
  CreateTicketWithNotificationOptions,
  EmailTemplate,
} from './plugins/create-ticket-with-notification';
export { TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES, USER_ROLES } from './enums';
export type { TicketPriority, TicketStatus, TicketType, UserRole } from './enums';
export type {
  CustomFieldEntry,
  CustomFieldMapping,
  SearchParams,
  ZendeskClientOptions,
  ZendeskRecord,
  ZendeskResource,
} from './types';
export { UnsupportedOperatorError, ZendeskApiError, ZendeskConfigurationError } from './errors';
