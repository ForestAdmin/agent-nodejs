import type { ZendeskClient } from '../../src/client';
import type {
  ActionContextSingle,
  ActionDefinition,
  CollectionCustomizer,
  DataSourceCustomizer,
  DynamicForm,
} from '@forestadmin/datasource-customizer';

import ResultBuilder from '@forestadmin/datasource-customizer/dist/decorators/actions/result-builder';

import { createTicketWithNotificationPlugin } from '../../src/plugins/create-ticket-with-notification';
import {
  FORM_FIELDS,
  buildForm,
  interpolate,
} from '../../src/plugins/create-ticket-with-notification/form-builder';

const NOOP_DATASOURCE = {} as DataSourceCustomizer;

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

function makeClient(): jest.Mocked<ZendeskClient> {
  return {
    createTicket: jest.fn().mockResolvedValue({ id: 99 }),
  } as unknown as jest.Mocked<ZendeskClient>;
}

function buildContext(
  formValues: Record<string, unknown>,
  overrides: Partial<ActionContextSingle> = {},
): ActionContextSingle {
  return {
    formValues,
    getRecord: jest.fn().mockResolvedValue({}),
    collection: {
      update: jest.fn().mockResolvedValue(undefined),
    },
    filter: {},
    ...overrides,
  } as unknown as ActionContextSingle;
}

describe('interpolate', () => {
  it('replaces {{ record.field }} with the record value', () => {
    expect(interpolate('Hello {{ record.name }}', { name: 'Alice' })).toBe('Hello Alice');
  });

  it('supports dotted paths', () => {
    expect(interpolate('{{ record.org.name }}', { org: { name: 'Acme' } })).toBe('Acme');
  });

  it('renders an empty string when the path is missing', () => {
    expect(interpolate('Hello {{ record.missing }}!', {})).toBe('Hello !');
  });

  it('leaves text without tokens unchanged', () => {
    expect(interpolate('no token', {})).toBe('no token');
  });
});

describe('buildForm', () => {
  it('returns a single-page form with no Template field when emailTemplates is missing', () => {
    const form = buildForm({}) as Array<{ label?: string }>;

    const labels = form.map(f => f.label).filter(Boolean);
    expect(labels).toContain(FORM_FIELDS.requesterEmail);
    expect(labels).toContain(FORM_FIELDS.subject);
    expect(labels).toContain(FORM_FIELDS.message);
    expect(labels).not.toContain(FORM_FIELDS.template);
  });

  it('omits the Priority field when priorityOverride is provided', () => {
    const form = buildForm({ priorityOverride: 'high' }) as Array<{ label?: string }>;

    expect(form.map(f => f.label)).not.toContain(FORM_FIELDS.priority);
  });

  it('omits the Type field when typeOverride is provided', () => {
    const form = buildForm({ typeOverride: 'task' }) as Array<{ label?: string }>;

    expect(form.map(f => f.label)).not.toContain(FORM_FIELDS.type);
  });

  it('includes the internal-note toggle when showInternalNote is true', () => {
    const form = buildForm({ showInternalNote: true }) as Array<{ label?: string }>;

    expect(form.map(f => f.label)).toContain(FORM_FIELDS.internalNote);
  });

  it('returns a multi-page form when emailTemplates is provided', () => {
    const form = buildForm({
      emailTemplates: [{ title: 'Welcome', content: 'Hi {{ record.name }}' }],
    }) as DynamicForm;

    expect(form).toHaveLength(2);
    expect((form[0] as { component?: string }).component).toBe('Page');
    expect((form[1] as { component?: string }).component).toBe('Page');
  });
});

describe('record interpolation on the form', () => {
  type FormField = { label?: string; defaultValue?: unknown; value?: unknown };

  function findField(form: DynamicForm, label: string): FormField {
    const pages = Array.isArray(form) ? form : [form];

    for (const page of pages) {
      const elements = ((page as { elements?: FormField[] }).elements ?? [page]) as FormField[];
      const found = elements.find(element => element.label === label);
      if (found) return found;
    }

    throw new Error(`Field '${label}' not found`);
  }

  function ctxWithRecord(
    record: Record<string, unknown>,
    formValues: Record<string, unknown> = {},
  ): ActionContextSingle {
    return {
      formValues,
      getRecord: jest.fn().mockResolvedValue(record),
      collection: { schema: { fields: { email: { type: 'Column' }, job: { type: 'Column' } } } },
    } as unknown as ActionContextSingle;
  }

  it('pre-fills the requester email from the selected record', async () => {
    const form = buildForm({
      emailTemplates: [{ title: 'Welcome', content: 'Hi' }],
      requesterEmailDefault: record => String(record.email ?? ''),
    });
    const field = findField(form, FORM_FIELDS.requesterEmail);
    const ctx = ctxWithRecord({ email: 'a@b.com' });

    const value = await (field.defaultValue as (c: ActionContextSingle) => Promise<string>)(ctx);

    expect(ctx.getRecord).toHaveBeenCalledWith(['email', 'job']);
    expect(value).toBe('a@b.com');
  });

  it('interpolates the record into the selected template message', async () => {
    const form = buildForm({
      emailTemplates: [{ title: 'Welcome', content: 'Hi {{ record.email }}!' }],
    });
    const field = findField(form, FORM_FIELDS.message);
    const ctx = ctxWithRecord({ email: 'a@b.com' }, { [FORM_FIELDS.template]: 'Welcome' });

    const value = await (field.value as (c: ActionContextSingle) => Promise<string>)(ctx);

    expect(value).toBe('Hi a@b.com!');
  });
});

describe('createTicketWithNotificationPlugin', () => {
  it('throws when called on the datasource (no collection)', async () => {
    await expect(
      createTicketWithNotificationPlugin(NOOP_DATASOURCE, null as unknown as CollectionCustomizer, {
        client: makeClient(),
      }),
    ).rejects.toThrow('only be used on collections');
  });

  it('throws when neither a client nor credentials are given', async () => {
    const { collection } = captureCollectionCustomizer();

    await expect(
      createTicketWithNotificationPlugin(
        NOOP_DATASOURCE,
        collection,
        {} as Parameters<typeof createTicketWithNotificationPlugin>[2],
      ),
    ).rejects.toThrow('missing required configuration: subdomain, email, apiToken');
  });

  it('builds a client from raw credentials when no client instance is provided', async () => {
    const { collection, actions } = captureCollectionCustomizer();

    await createTicketWithNotificationPlugin(NOOP_DATASOURCE, collection, {
      subdomain: 'acme',
      email: 'agent@acme.com',
      apiToken: 'secret',
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].name).toBe('Create ticket and notify');
  });

  it('registers a single action with the configured name', async () => {
    const { collection, actions } = captureCollectionCustomizer();

    await createTicketWithNotificationPlugin(NOOP_DATASOURCE, collection, {
      client: makeClient(),
      actionName: 'Send a follow-up',
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].name).toBe('Send a follow-up');
    expect(actions[0].definition.scope).toBe('Single');
  });

  describe('execute', () => {
    async function runExecute(
      options: Parameters<typeof createTicketWithNotificationPlugin>[2],
      formValues: Record<string, unknown>,
      contextOverrides: Partial<ActionContextSingle> = {},
    ): Promise<{ type: string; message?: string }> {
      const { collection, actions } = captureCollectionCustomizer();
      await createTicketWithNotificationPlugin(NOOP_DATASOURCE, collection, options);
      const { definition } = actions[0];
      const context = buildContext(formValues, contextOverrides);
      const { execute } = definition as ActionDefinition & {
        execute: (
          ctx: ActionContextSingle,
          rb: ResultBuilder,
        ) => Promise<{ type: string; message?: string }>;
      };

      return (await execute(context, new ResultBuilder())) as { type: string; message?: string };
    }

    it('rejects when the requester email is missing', async () => {
      const result = await runExecute(
        { client: makeClient() },
        { [FORM_FIELDS.subject]: 'hi', [FORM_FIELDS.message]: 'body' },
      );

      expect(result.type).toBe('Error');
      expect(result.message).toContain('Requester email is required');
    });

    it('creates a public ticket and returns a notification-style success message', async () => {
      const client = makeClient();
      const result = await runExecute(
        { client },
        {
          [FORM_FIELDS.requesterEmail]: 'foo@example.com',
          [FORM_FIELDS.subject]: 'Subject',
          [FORM_FIELDS.message]: '<p>Hi</p>',
          [FORM_FIELDS.priority]: 'high',
          [FORM_FIELDS.type]: 'question',
        },
      );

      expect(client.createTicket).toHaveBeenCalledWith({
        requester: { email: 'foo@example.com', name: 'foo' },
        subject: 'Subject',
        comment: { html_body: '<p>Hi</p>', public: true },
        priority: 'high',
        type: 'question',
      });
      expect(result.type).toBe('Success');
      expect(result.message).toContain('created and requester notified');
    });

    it('honours priorityOverride and typeOverride (form values are ignored)', async () => {
      const client = makeClient();
      await runExecute(
        { client, priorityOverride: 'urgent', typeOverride: 'task' },
        {
          [FORM_FIELDS.requesterEmail]: 'a@b.com',
          [FORM_FIELDS.subject]: 's',
          [FORM_FIELDS.message]: 'b',
          [FORM_FIELDS.priority]: 'low',
          [FORM_FIELDS.type]: 'incident',
        },
      );

      expect(client.createTicket).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'urgent', type: 'task' }),
      );
    });

    it('marks the comment as private and tweaks the success message when internal note is checked', async () => {
      const client = makeClient();
      const result = await runExecute(
        { client, showInternalNote: true },
        {
          [FORM_FIELDS.requesterEmail]: 'a@b.com',
          [FORM_FIELDS.subject]: 's',
          [FORM_FIELDS.message]: 'b',
          [FORM_FIELDS.internalNote]: true,
        },
      );

      expect(client.createTicket).toHaveBeenCalledWith(
        expect.objectContaining({ comment: expect.objectContaining({ public: false }) }),
      );
      expect(result.message).toContain('internal note, no email');
    });

    it('writes the created ticket id back when ticketIdField is configured', async () => {
      const client = makeClient();
      client.createTicket.mockResolvedValue({ id: 555 });
      const update = jest.fn().mockResolvedValue(undefined);

      await runExecute(
        { client, ticketIdField: 'zendesk_id' },
        {
          [FORM_FIELDS.requesterEmail]: 'a@b.com',
          [FORM_FIELDS.subject]: 's',
          [FORM_FIELDS.message]: 'b',
        },
        {
          collection: { update } as unknown as ActionContextSingle['collection'],
        },
      );

      expect(update).toHaveBeenCalledWith({}, { zendesk_id: 555 });
    });

    it('appends a warning when the writeback fails', async () => {
      const client = makeClient();
      const update = jest.fn().mockRejectedValue(new Error('permission denied'));

      const result = await runExecute(
        { client, ticketIdField: 'zendesk_id' },
        {
          [FORM_FIELDS.requesterEmail]: 'a@b.com',
          [FORM_FIELDS.subject]: 's',
          [FORM_FIELDS.message]: 'b',
        },
        { collection: { update } as unknown as ActionContextSingle['collection'] },
      );

      expect(result.message).toContain('Warning: failed to write ticket id');
    });

    it('returns error when the API call fails', async () => {
      const client = makeClient();
      client.createTicket.mockRejectedValue(new Error('boom'));

      const result = await runExecute(
        { client },
        {
          [FORM_FIELDS.requesterEmail]: 'a@b.com',
          [FORM_FIELDS.subject]: 's',
          [FORM_FIELDS.message]: 'b',
        },
      );

      expect(result.type).toBe('Error');
      expect(result.message).toContain('Failed to create Zendesk ticket: boom');
    });
  });
});
