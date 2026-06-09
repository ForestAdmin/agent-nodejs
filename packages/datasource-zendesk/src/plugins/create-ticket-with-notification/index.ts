import type { EmailTemplate, FormBuilderOptions } from './form-builder';
import type { ZendeskClient } from '../../client';
import type { TicketPriority, TicketType } from '../../enums';
import type { ZendeskRecord } from '../../types';
import type {
  ActionContextSingle,
  CollectionCustomizer,
  DataSourceCustomizer,
  Plugin,
} from '@forestadmin/datasource-customizer';

import { FORM_FIELDS, buildForm } from './form-builder';

export type { EmailTemplate };

export type CreateTicketWithNotificationOptions = {
  client: ZendeskClient;
  actionName?: string;
  emailTemplates?: EmailTemplate[];
  requesterEmailDefault?: FormBuilderOptions['requesterEmailDefault'];
  defaultSubject?: FormBuilderOptions['defaultSubject'];
  defaultMessage?: FormBuilderOptions['defaultMessage'];
  priorityOverride?: TicketPriority;
  typeOverride?: TicketType;
  senderEmail?: string;
  ticketIdField?: string;
  showInternalNote?: boolean;
};

function stringValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;

  return undefined;
}

function deriveName(email: string): string {
  const at = email.indexOf('@');

  return at > 0 ? email.substring(0, at) : email;
}

async function tryWritebackTicketId(
  context: ActionContextSingle,
  field: string,
  ticketId: number | string,
): Promise<string> {
  try {
    await context.collection.update(context.filter, { [field]: ticketId });

    return '';
  } catch (error) {
    return `(Warning: failed to write ticket id back to '${field}': ${
      error instanceof Error ? error.message : String(error)
    })`;
  }
}

export const createTicketWithNotificationPlugin: Plugin<
  CreateTicketWithNotificationOptions
> = async (
  _dataSource: DataSourceCustomizer,
  collection: CollectionCustomizer,
  options?: CreateTicketWithNotificationOptions,
) => {
  if (!collection) {
    throw new Error('createTicketWithNotificationPlugin can only be used on collections.');
  }

  if (!options?.client) {
    throw new Error('createTicketWithNotificationPlugin requires a `client` option.');
  }

  const actionName = options.actionName ?? 'Create ticket and notify';

  collection.addAction(actionName, {
    scope: 'Single',
    form: buildForm(options),
    execute: async (context, resultBuilder) => {
      const { formValues } = context;
      const requesterEmail = stringValue(formValues[FORM_FIELDS.requesterEmail]);

      if (!requesterEmail) {
        return resultBuilder.error('Requester email is required.');
      }

      const internalNote = options.showInternalNote
        ? Boolean(formValues[FORM_FIELDS.internalNote])
        : false;

      const payload: ZendeskRecord = {
        requester: { email: requesterEmail, name: deriveName(requesterEmail) },
        subject: stringValue(formValues[FORM_FIELDS.subject]),
        comment: {
          html_body: stringValue(formValues[FORM_FIELDS.message]) ?? '',
          public: !internalNote,
        },
      };

      const priority = options.priorityOverride ?? stringValue(formValues[FORM_FIELDS.priority]);
      if (priority) payload.priority = priority;

      const type = options.typeOverride ?? stringValue(formValues[FORM_FIELDS.type]);
      if (type) payload.type = type;

      if (options.senderEmail) payload.recipient = options.senderEmail;

      let created: ZendeskRecord;

      try {
        created = await options.client.createTicket(payload);
      } catch (error) {
        return resultBuilder.error(
          `Failed to create Zendesk ticket: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      const ticketId = created.id;
      let writebackWarning = '';

      if (options.ticketIdField && (typeof ticketId === 'number' || typeof ticketId === 'string')) {
        writebackWarning = await tryWritebackTicketId(
          context as ActionContextSingle,
          options.ticketIdField,
          ticketId,
        );
      }

      const baseMessage = internalNote
        ? `Ticket #${ticketId} created (internal note, no email).`
        : `Ticket #${ticketId} created and requester notified.`;

      return resultBuilder.success(
        writebackWarning ? `${baseMessage} ${writebackWarning}` : baseMessage,
      );
    },
  });
};
