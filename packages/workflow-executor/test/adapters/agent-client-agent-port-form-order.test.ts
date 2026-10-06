import type { StepUser } from '../../src/types/execution-context';
import type { AddressInfo } from 'net';

import http from 'http';

import AgentClientAgentPort from '../../src/adapters/agent-client-agent-port';
import SchemaCache from '../../src/schema-cache';

type Field = Record<string, unknown> & { field: string; value?: unknown; enums?: unknown[] };

const ENDPOINT = '/forest/actions/org-closing-account-request';
const DETAILS_BY_CATEGORY: Record<string, string[]> = {
  Fraud: ['Financial - Suspicious Operations'],
};

function loadedFields(): Field[] {
  return [
    {
      field: 'closing_reason_initiative',
      type: 'Enum',
      enums: ['client', 'qonto'],
      hook: 'onFieldChanged',
      isRequired: true,
      value: null,
    },
    { field: 'internal_note', type: 'String', isRequired: false, value: null },
    {
      field: 'closing_reason_category',
      type: 'Enum',
      enums: [],
      hook: 'onFieldChanged',
      isRequired: true,
      isReadOnly: true,
      value: null,
    },
    {
      field: 'closing_reason_details',
      type: 'Enum',
      enums: [],
      hook: 'onFieldChanged',
      isRequired: true,
      isReadOnly: true,
      value: null,
    },
  ];
}

function changeHook(fields: Field[]): Field[] {
  const byName = (name: string) => fields.find(f => f.field === name);
  const initiative = byName('closing_reason_initiative')?.value;
  const category = byName('closing_reason_category')?.value as string | undefined;
  const details = byName('closing_reason_details')?.value;
  let result = fields;

  if (initiative) {
    Object.assign(byName('closing_reason_category'), {
      enums: Object.keys(DETAILS_BY_CATEGORY),
      isReadOnly: false,
    });
  }

  if (initiative && category && DETAILS_BY_CATEGORY[category]) {
    Object.assign(byName('closing_reason_details'), {
      enums: DETAILS_BY_CATEGORY[category],
      isReadOnly: false,
    });
  }

  if (details) {
    result = result.filter(f => f.field !== 'internal_note');

    if (!byName('block_fx')) {
      result = [...result, { field: 'block_fx', type: 'Boolean', isRequired: false, value: null }];
    }
  }

  return result;
}

// forest-rails' handle_result: an Enum value missing from its enums is reset on every hook answer.
function resetValuesMissingFromEnums(fields: Field[]): Field[] {
  return fields.map(f =>
    Array.isArray(f.enums) && !f.enums.includes(f.value) ? { ...f, value: null } : f,
  );
}

describe('AgentClientAgentPort: values applied in the form order', () => {
  let server: http.Server;
  let port: AgentClientAgentPort;
  let submittedValues: Record<string, unknown> | undefined;

  const user = {
    id: 1,
    email: 'ops@example.com',
    firstName: 'Ops',
    lastName: 'User',
    team: 'Ops',
    renderingId: 1,
    role: 'admin',
    permissionLevel: 'admin',
    tags: {},
  } as unknown as StepUser;
  const query = { collection: 'organizations', action: 'Closing Account Request', id: ['org-1'] };
  const outOfOrder = {
    closing_reason_details: 'Financial - Suspicious Operations',
    closing_reason_category: 'Fraud',
    closing_reason_initiative: 'qonto',
  };

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', chunk => {
        raw += chunk;
      });
      req.on('end', () => {
        const body = raw ? JSON.parse(raw) : {};
        const path = (req.url ?? '').split('?')[0];
        res.setHeader('content-type', 'application/json');

        if (path === `${ENDPOINT}/hooks/load`) {
          res.end(JSON.stringify({ fields: resetValuesMissingFromEnums(loadedFields()) }));
        } else if (path === `${ENDPOINT}/hooks/change`) {
          const fields = changeHook(body.data.attributes.fields);
          res.end(JSON.stringify({ fields: resetValuesMissingFromEnums(fields) }));
        } else if (path === ENDPOINT) {
          submittedValues = body.data.attributes.values;
          res.end(JSON.stringify({ success: 'Closing request submitted' }));
        } else {
          res.statusCode = 404;
          res.end('{}');
        }
      });
    });
    await new Promise<void>(resolve => {
      server.listen(0, resolve);
    });

    const schemaCache = new SchemaCache();
    schemaCache.set(1, 'organizations', {
      collectionName: 'organizations',
      collectionId: 'col-organizations',
      collectionDisplayName: 'Organizations',
      primaryKeyFields: ['id'],
      fields: [{ fieldName: 'id', displayName: 'id', isRelationship: false }],
      actions: [
        {
          name: 'Closing Account Request',
          displayName: 'Closing Account Request',
          endpoint: ENDPOINT,
          hooks: { load: true, change: ['onFieldChanged'] },
          fields: loadedFields(),
          layout: [],
        },
      ],
    } as unknown as Parameters<SchemaCache['set']>[2]);

    port = new AgentClientAgentPort({
      agentUrl: `http://localhost:${(server.address() as AddressInfo).port}`,
      authSecret: 'secret',
      schemaCache,
    });
  });

  afterAll(async () => {
    await new Promise(resolve => {
      server.close(resolve);
    });
  });

  beforeEach(() => {
    submittedValues = undefined;
  });

  it('keeps the values a hook would clear when they arrive before the field they depend on', async () => {
    const form = await port.getActionForm({ ...query, values: outOfOrder }, user);

    expect(form.canExecute).toBe(true);
    expect(Object.fromEntries(form.fields.map(f => [f.name, f.value]))).toEqual({
      closing_reason_initiative: 'qonto',
      closing_reason_category: 'Fraud',
      closing_reason_details: 'Financial - Suspicious Operations',
      block_fx: null,
    });
  });

  it('submits every value when they arrive before the field they depend on', async () => {
    await port.executeAction({ ...query, values: outOfOrder }, { user });

    expect(submittedValues).toEqual({
      closing_reason_initiative: 'qonto',
      closing_reason_category: 'Fraud',
      closing_reason_details: 'Financial - Suspicious Operations',
      block_fx: null,
    });
  });

  it('applies a value for a field a hook reveals after the values that reveal it', async () => {
    const form = await port.getActionForm(
      { ...query, values: { block_fx: true, ...outOfOrder } },
      user,
    );

    expect(form.skippedFields).toEqual([]);
    expect(form.fields.find(f => f.name === 'block_fx')?.value).toBe(true);
  });

  it('submits without an earlier field that a later field removes', async () => {
    await port.executeAction(
      { ...query, values: { internal_note: 'checked', ...outOfOrder } },
      { user },
    );

    expect(submittedValues).toEqual({
      closing_reason_initiative: 'qonto',
      closing_reason_category: 'Fraud',
      closing_reason_details: 'Financial - Suspicious Operations',
      block_fx: null,
    });
  });
});
