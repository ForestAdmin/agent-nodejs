import type { ZendeskClient } from '../../src/client';
import type {
  ActionContext,
  ActionContextSingle,
  ActionDefinition,
  CollectionCustomizer,
  DataSourceCustomizer,
} from '@forestadmin/datasource-customizer';

import ResultBuilder from '@forestadmin/datasource-customizer/dist/decorators/actions/result-builder';

import { ZendeskApiError } from '../../src/errors';
import { closeTicketPlugin, closeTickets } from '../../src/plugins/close-ticket';
import { isAlreadyClosedError } from '../../src/plugins/close-ticket/errors';

function makeClient(): jest.Mocked<ZendeskClient> {
  return {
    updateTicket: jest.fn().mockResolvedValue({}),
  } as unknown as jest.Mocked<ZendeskClient>;
}

type CapturedAction = { name: string; definition: ActionDefinition };

function captureCollectionCustomizer(): {
  collection: CollectionCustomizer;
  actions: CapturedAction[];
} {
  const actions: CapturedAction[] = [];
  const collection = {
    name: 'mock',
    addAction: jest.fn((name: string, definition: ActionDefinition) => {
      actions.push({ name, definition });

      return collection;
    }),
  } as unknown as CollectionCustomizer;

  return { collection, actions };
}

const NOOP_DATASOURCE = {} as DataSourceCustomizer;

describe('closeTickets (helper)', () => {
  it('classifies a successful update as succeeded', async () => {
    const client = makeClient();
    const outcome = await closeTickets(client, [1, 2], 'solved');

    expect(client.updateTicket).toHaveBeenCalledWith(1, { status: 'solved' });
    expect(client.updateTicket).toHaveBeenCalledWith(2, { status: 'solved' });
    expect(outcome.succeeded).toEqual([1, 2]);
    expect(outcome.failed).toEqual([]);
    expect(outcome.alreadyClosed).toEqual([]);
  });

  it('classifies a Zendesk 422 "closed prevents ticket update" as already closed', async () => {
    const client = makeClient();
    client.updateTicket.mockImplementationOnce(async () => {
      throw new ZendeskApiError('update(tickets/1)', 422, {
        details: {
          status: [{ description: 'Status: closed prevents ticket update' }],
        },
      });
    });
    const outcome = await closeTickets(client, [1], 'solved');

    expect(outcome.alreadyClosed).toEqual([1]);
    expect(outcome.failed).toEqual([]);
  });

  it('captures arbitrary failures as failed with their message', async () => {
    const client = makeClient();
    client.updateTicket.mockRejectedValueOnce(new ZendeskApiError('boom', 500, {}));
    const outcome = await closeTickets(client, [9], 'closed');

    expect(outcome.failed).toEqual([{ id: 9, error: expect.stringContaining('boom') }]);
    expect(outcome.succeeded).toEqual([]);
  });
});

describe('isAlreadyClosedError', () => {
  it('returns true when description matches the closed-pattern under details.status', () => {
    const err = new ZendeskApiError('update', 422, {
      details: { status: [{ description: 'Status: closed prevents ticket update' }] },
    });

    expect(isAlreadyClosedError(err)).toBe(true);
  });

  it('returns false when the body has a different 422 reason', () => {
    const err = new ZendeskApiError('update', 422, { description: 'permission denied' });

    expect(isAlreadyClosedError(err)).toBe(false);
  });

  it('returns false for non-ZendeskApiError errors', () => {
    expect(isAlreadyClosedError(new Error('boom'))).toBe(false);
  });
});

describe('closeTicketPlugin', () => {
  it('throws if invoked at the datasource level', async () => {
    const client = makeClient();

    await expect(
      closeTicketPlugin(NOOP_DATASOURCE, null as unknown as CollectionCustomizer, {
        client,
        ticketIdField: 'id',
      }),
    ).rejects.toThrow('only be used on collections');
  });

  it('throws when ticketIdField is missing', async () => {
    const { collection } = captureCollectionCustomizer();

    await expect(closeTicketPlugin(NOOP_DATASOURCE, collection)).rejects.toThrow(
      'requires a `ticketIdField`',
    );
  });

  it('throws when neither a client nor credentials are given', async () => {
    const { collection } = captureCollectionCustomizer();

    await expect(
      closeTicketPlugin(NOOP_DATASOURCE, collection, {
        ticketIdField: 'id',
      } as Parameters<typeof closeTicketPlugin>[2]),
    ).rejects.toThrow('missing required configuration: subdomain, email, apiToken');
  });

  it('builds a client from raw credentials when no client instance is provided', async () => {
    const { collection, actions } = captureCollectionCustomizer();

    await closeTicketPlugin(NOOP_DATASOURCE, collection, {
      ticketIdField: 'id',
      subdomain: 'acme',
      email: 'agent@acme.com',
      apiToken: 'secret',
    });

    expect(actions.length).toBeGreaterThan(0);
  });

  it('registers Single and Bulk actions for each requested status (default 2 statuses x 2 scopes = 4 actions)', async () => {
    const { collection, actions } = captureCollectionCustomizer();
    const client = makeClient();

    await closeTicketPlugin(NOOP_DATASOURCE, collection, { client, ticketIdField: 'id' });

    expect(actions.map(a => a.name)).toEqual([
      'Mark Zendesk ticket as solved',
      'Mark selected Zendesk tickets as solved',
      'Mark Zendesk ticket as closed',
      'Mark selected Zendesk tickets as closed',
    ]);
    expect(actions.map(a => a.definition.scope)).toEqual(['Single', 'Bulk', 'Single', 'Bulk']);
  });

  it('respects the `statuses` and `scopes` options', async () => {
    const { actions, collection } = captureCollectionCustomizer();
    const client = makeClient();

    await closeTicketPlugin(NOOP_DATASOURCE, collection, {
      client,
      ticketIdField: 'id',
      statuses: ['solved'],
      scopes: ['Single'],
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].name).toBe('Mark Zendesk ticket as solved');
    expect(actions[0].definition.scope).toBe('Single');
  });

  describe('execute', () => {
    async function runExecute(
      pluginOptions: { ticketIdField: string },
      records: Array<Record<string, unknown>>,
      client: ZendeskClient,
      scope: 'Single' | 'Bulk' = 'Single',
    ) {
      const { collection, actions } = captureCollectionCustomizer();
      await closeTicketPlugin(NOOP_DATASOURCE, collection, {
        client,
        ticketIdField: pluginOptions.ticketIdField,
        statuses: ['solved'],
        scopes: [scope],
      });
      const definition = actions[0].definition as ActionDefinition & {
        execute: (ctx: ActionContext | ActionContextSingle, rb: ResultBuilder) => Promise<unknown>;
      };
      const context = {
        getRecords: jest.fn().mockResolvedValue(records),
      } as unknown as ActionContext;

      return definition.execute(context, new ResultBuilder());
    }

    it('returns success when the only ticket was updated', async () => {
      const client = makeClient();
      const result = (await runExecute(
        { ticketIdField: 'zendesk_id' },
        [{ zendesk_id: 7 }],
        client,
      )) as {
        type: string;
        message?: string;
      };

      expect(client.updateTicket).toHaveBeenCalledWith(7, { status: 'solved' });
      expect(result.type).toBe('Success');
      expect(result.message).toContain('Ticket #7 marked as solved.');
    });

    it('returns error when there is no id on the record', async () => {
      const client = makeClient();
      const result = (await runExecute({ ticketIdField: 'zendesk_id' }, [{}], client)) as {
        type: string;
        message?: string;
      };

      expect(result.type).toBe('Error');
      expect(result.message).toContain('No ticket id');
    });

    it('returns success with mixed counts when some tickets were already closed', async () => {
      const client = makeClient();
      client.updateTicket.mockImplementationOnce(async () => ({}));
      client.updateTicket.mockImplementationOnce(async () => {
        throw new ZendeskApiError('update(tickets/8)', 422, {
          details: { status: [{ description: 'Status: closed prevents ticket update' }] },
        });
      });

      const result = (await runExecute(
        { ticketIdField: 'zendesk_id' },
        [{ zendesk_id: 7 }, { zendesk_id: 8 }],
        client,
        'Bulk',
      )) as { type: string; message?: string };

      expect(result.type).toBe('Success');
      expect(result.message).toContain('1 ticket(s) marked as solved.');
      expect(result.message).toContain('1 ticket(s) were already closed');
    });

    it('returns error when every update failed without already-closed signature', async () => {
      const client = makeClient();
      client.updateTicket.mockRejectedValue(new ZendeskApiError('boom', 500, {}));

      const result = (await runExecute(
        { ticketIdField: 'zendesk_id' },
        [{ zendesk_id: 9 }],
        client,
      )) as {
        type: string;
        message?: string;
      };

      expect(result.type).toBe('Error');
      expect(result.message).toContain('Failed to solve ticket #9');
    });
  });
});
