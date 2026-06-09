import type { CloseTicketOutcome, CloseTicketStatus } from './messages';
import type { ZendeskClient } from '../../client';
import type {
  CollectionCustomizer,
  DataSourceCustomizer,
  Plugin,
} from '@forestadmin/datasource-customizer';
import type { ActionScope } from '@forestadmin/datasource-toolkit';

import { isAlreadyClosedError } from './errors';
import { buildErrorMessage, buildSuccessMessage } from './messages';
import { CLOSEABLE_STATUSES } from '../../enums';

export type CloseTicketOptions = {
  client: ZendeskClient;
  ticketIdField: string;
  statuses?: ReadonlyArray<CloseTicketStatus>;
  scopes?: ReadonlyArray<Extract<ActionScope, 'Single' | 'Bulk'>>;
};

const DEFAULT_SCOPES: ReadonlyArray<Extract<ActionScope, 'Single' | 'Bulk'>> = ['Single', 'Bulk'];

function actionLabel(scope: ActionScope, status: CloseTicketStatus): string {
  return scope === 'Single'
    ? `Mark Zendesk ticket as ${status}`
    : `Mark selected Zendesk tickets as ${status}`;
}

export async function closeTickets(
  client: ZendeskClient,
  ids: Array<number | string>,
  status: CloseTicketStatus,
): Promise<CloseTicketOutcome> {
  const outcome: CloseTicketOutcome = {
    succeeded: [],
    alreadyClosed: [],
    failed: [],
  };

  for (const id of ids) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await client.updateTicket(id, { status });
      outcome.succeeded.push(id);
    } catch (error) {
      if (isAlreadyClosedError(error)) {
        outcome.alreadyClosed.push(id);
      } else {
        outcome.failed.push({
          id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return outcome;
}

export const closeTicketPlugin: Plugin<CloseTicketOptions> = async (
  _dataSource: DataSourceCustomizer,
  collection: CollectionCustomizer,
  options?: CloseTicketOptions,
) => {
  if (!collection) {
    throw new Error('closeTicketPlugin can only be used on collections.');
  }

  if (!options?.client || !options.ticketIdField) {
    throw new Error('closeTicketPlugin requires `client` and `ticketIdField` options.');
  }

  const statuses = options.statuses ?? CLOSEABLE_STATUSES;
  const scopes = options.scopes ?? DEFAULT_SCOPES;

  for (const status of statuses) {
    for (const scope of scopes) {
      collection.addAction(actionLabel(scope, status), {
        scope,
        execute: async (context, resultBuilder) => {
          const records = (await context.getRecords([options.ticketIdField])) as Array<
            Record<string, unknown>
          >;

          const ids = records
            .map(record => record[options.ticketIdField])
            .filter(
              (id): id is number | string =>
                typeof id === 'number' || (typeof id === 'string' && id.length > 0),
            );

          if (ids.length === 0) {
            return resultBuilder.error('No ticket id available on the selected record(s).');
          }

          const outcome = await closeTickets(options.client, ids, status);

          if (outcome.succeeded.length === 0 && outcome.alreadyClosed.length === 0) {
            return resultBuilder.error(buildErrorMessage(outcome, status));
          }

          return resultBuilder.success(buildSuccessMessage(outcome, status));
        },
      });
    }
  }
};
