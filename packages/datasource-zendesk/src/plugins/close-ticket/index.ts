import type { CloseTicketOutcome, CloseTicketStatus } from './messages';
import type { ZendeskClient } from '../../client';
import type { ZendeskClientProvider } from '../../client-options';
import type {
  CollectionCustomizer,
  DataSourceCustomizer,
  Plugin,
} from '@forestadmin/datasource-customizer';
import type { ActionScope, Logger } from '@forestadmin/datasource-toolkit';

import { isAlreadyClosedError } from './errors';
import { buildErrorMessage, buildSuccessMessage } from './messages';
import { resolveZendeskClient } from '../../client-options';
import { CLOSEABLE_STATUSES } from '../../enums';

export type CloseTicketOptions = {
  ticketIdField: string;
  statuses?: ReadonlyArray<CloseTicketStatus>;
  scopes?: ReadonlyArray<Extract<ActionScope, 'Single' | 'Bulk'>>;
} & ZendeskClientProvider;

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
  logger?: Logger,
) => {
  if (!collection) {
    throw new Error('closeTicketPlugin can only be used on collections.');
  }

  if (!options?.ticketIdField) {
    throw new Error('closeTicketPlugin requires a `ticketIdField` option.');
  }

  const client = resolveZendeskClient(options, logger);
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

          const outcome = await closeTickets(client, ids, status);

          if (outcome.succeeded.length === 0 && outcome.alreadyClosed.length === 0) {
            return resultBuilder.error(buildErrorMessage(outcome, status));
          }

          return resultBuilder.success(buildSuccessMessage(outcome, status));
        },
      });
    }
  }
};
