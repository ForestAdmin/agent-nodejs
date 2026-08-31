import type { Logger } from '../../src/ports/logger-port';
import type {
  CapabilitiesFetcher,
  CapabilitiesResult,
} from '../../src/read-model/capabilities-cache';
import type ReadModelStore from '../../src/read-model/read-model-store';

import collectUnfolding from '../../src/openapi/collect-unfolding';
import ReadModel from '../../src/read-model/read-model';
import { action, collection, column, polymorphic, relation } from '../read-model/fixtures';

const noopLogger: Logger = () => undefined;

function storeOf(readModel: ReadModel): ReadModelStore {
  return {
    getReadModel: async () => readModel,
    getCapabilities: async (name: string, fetcher: CapabilitiesFetcher) => ({
      capabilities: await fetcher(name),
      readModel,
    }),
  } as unknown as ReadModelStore;
}

const CAPABILITIES: CapabilitiesResult = {
  fields: [
    { name: 'id', type: 'Number', operators: ['equal'] },
    { name: 'author', type: 'ManyToOne' },
  ],
};

function collect(
  readModel: ReadModel,
  {
    capabilities = async () => CAPABILITIES,
    logger = noopLogger,
    concurrency,
  }: {
    capabilities?: CapabilitiesFetcher;
    logger?: Logger;
    concurrency?: number;
  } = {},
) {
  return collectUnfolding({
    readModel,
    store: storeOf(readModel),
    capabilitiesFetcher: capabilities,
    logger,
    concurrency,
  });
}

describe('collectUnfolding', () => {
  describe('relations', () => {
    const readModel = new ReadModel([
      collection('users', [
        column('id'),
        relation('orders', 'HasMany', 'orders.userId'),
        relation('roles', 'BelongsToMany', 'roles.id'),
        relation('company', 'BelongsTo', 'companies.id'),
        relation('profile', 'HasOne', 'profiles.userId'),
        polymorphic('owner', ['orders', 'roles']),
        relation('secrets', 'HasMany', 'secrets.userId'),
      ]),
      collection('orders', [column('id')]),
      collection('roles', [column('id')]),
      collection('companies', [column('id')]),
      collection('profiles', [column('id')]),
    ]);

    it('should keep only the to-many relations whose foreign collection is exposed', async () => {
      const { collections } = await collect(readModel);
      const users = collections.find(entry => entry.name === 'users');

      expect(users?.relations).toEqual([
        { name: 'orders', foreignCollection: 'orders' },
        { name: 'roles', foreignCollection: 'roles' },
      ]);
    });

    it('should drop a to-many relation pointing at a collection the BFF does not expose', async () => {
      const { collections } = await collect(readModel);
      const users = collections.find(entry => entry.name === 'users');

      expect(users?.relations.map(entry => entry.name)).not.toContain('secrets');
    });
  });

  describe('fields', () => {
    const readModel = new ReadModel([collection('users', [column('id')])]);

    it('should split projectable from filterable, since a ManyToOne carries no operator', async () => {
      const { collections } = await collect(readModel);

      expect(collections[0].fields).toEqual({
        projectable: [
          { name: 'id', type: 'Number' },
          { name: 'author', type: 'ManyToOne' },
        ],
        filterable: [{ name: 'id', operators: ['Equal'] }],
        degraded: null,
      });
    });

    it('should normalize the capabilities operators to their canonical PascalCase form', async () => {
      const { collections } = await collect(readModel, {
        capabilities: async () => ({
          fields: [{ name: 'id', type: 'String', operators: ['i_contains', 'not_equal'] }],
        }),
      });

      expect(collections[0].fields.filterable).toEqual([
        { name: 'id', operators: ['NotEqual', 'IContains'] },
      ]);
    });

    it('should order the operators canonically, whatever order the agent listed them in', async () => {
      const forward = await collect(readModel, {
        capabilities: async () => ({
          fields: [{ name: 'id', type: 'String', operators: ['equal', 'contains', 'in'] }],
        }),
      });
      const backward = await collect(readModel, {
        capabilities: async () => ({
          fields: [{ name: 'id', type: 'String', operators: ['in', 'contains', 'equal'] }],
        }),
      });

      expect(forward.collections[0].fields.filterable).toEqual([
        { name: 'id', operators: ['Equal', 'In', 'Contains'] },
      ]);
      expect(backward.collections[0].fields.filterable).toEqual(
        forward.collections[0].fields.filterable,
      );
    });

    // The runtime answers 500 mapping_error on ANY filter on such a field, `Equal` included, because
    // the validator normalizes the field's whole operator list before comparing the one that was sent.
    it('should drop a field carrying an operator the BFF cannot map, and log the skew', async () => {
      const logger = jest.fn();
      const { collections } = await collect(readModel, {
        capabilities: async () => ({
          fields: [
            { name: 'id', type: 'String', operators: ['equal', 'teleports_to'] },
            { name: 'email', type: 'String', operators: ['equal'] },
          ],
        }),
        logger,
      });

      expect(collections[0].fields.filterable).toEqual([{ name: 'email', operators: ['Equal'] }]);
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'Documenting a field as not filterable: one of its operators has no mapping',
        { collection: 'users', field: 'id', operator: 'teleports_to' },
      );
    });

    it('should keep a skewed field projectable, since only filtering on it fails', async () => {
      const { collections } = await collect(readModel, {
        capabilities: async () => ({
          fields: [{ name: 'id', type: 'String', operators: ['equal', 'teleports_to'] }],
        }),
      });

      expect(collections[0].fields.projectable).toEqual([{ name: 'id', type: 'String' }]);
      expect(collections[0].fields.filterable).toEqual([]);
    });

    it('should not degrade a collection whose only problem is a skewed field', async () => {
      // `degraded` drives the memo guard and the degraded notes. Dropping the field keeps the document
      // truthful, so there is nothing to un-cache and nothing to warn a reader about.
      const { collections } = await collect(readModel, {
        capabilities: async () => ({
          fields: [{ name: 'id', type: 'String', operators: ['teleports_to'] }],
        }),
      });

      expect(collections[0].fields.degraded).toBeNull();
    });

    it('should degrade a collection whose capabilities call fails, and say so in the log', async () => {
      const logger = jest.fn();
      const { collections } = await collect(readModel, {
        capabilities: async () => {
          throw new Error('agent is down');
        },
        logger,
      });

      expect(collections[0].fields).toEqual({
        projectable: [],
        filterable: [],
        degraded: 'capabilities_unavailable',
      });
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'Documenting a collection without a field set: capabilities are unavailable',
        { collection: 'users', error: 'agent is down' },
      );
    });

    it('should degrade a collection the agent reports no field for', async () => {
      const logger = jest.fn();
      const { collections } = await collect(readModel, {
        capabilities: async () => ({ fields: [] }),
        logger,
      });

      expect(collections[0].fields.degraded).toBe('no_fields');
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'Documenting a collection without a field set: capabilities returned none',
        { collection: 'users' },
      );
    });
  });

  describe('actions', () => {
    it('should map the static form fields of every action with an endpoint', async () => {
      const withFields = action('Ban', '/forest/users/actions/ban');
      withFields.fields = [
        {
          field: 'reason',
          type: 'String',
          isRequired: true,
          enums: ['spam', 'abuse'],
        } as (typeof withFields.fields)[number],
      ];
      const readModel = new ReadModel([collection('users', [column('id')], [withFields])]);

      const { collections } = await collect(readModel);

      expect(collections[0].actions).toEqual([
        {
          name: 'Ban',
          fields: [{ name: 'reason', type: 'String', isRequired: true, enums: ['spam', 'abuse'] }],
        },
      ]);
    });

    it('should default a form field that declares neither isRequired nor enums', async () => {
      const bare = action('Ban', '/forest/users/actions/ban');
      bare.fields = [{ field: 'reason', type: 'String' } as (typeof bare.fields)[number]];
      const readModel = new ReadModel([collection('users', [column('id')], [bare])]);

      const { collections } = await collect(readModel);

      expect(collections[0].actions[0].fields).toEqual([
        { name: 'reason', type: 'String', isRequired: false, enums: null },
      ]);
    });

    it('should drop a form field with no usable name, which would document "undefined"', async () => {
      const malformed = action('Ban', '/forest/users/actions/ban');
      malformed.fields = [
        null,
        { field: 'reason', type: 'String' },
      ] as unknown as typeof malformed.fields;
      const readModel = new ReadModel([collection('users', [column('id')], [malformed])]);

      const { collections } = await collect(readModel);

      expect(collections[0].actions[0].fields.map(field => field.name)).toEqual(['reason']);
    });

    it('should treat an action with no fields key as a form with no field', async () => {
      const fieldless = action('Ban', '/forest/users/actions/ban');
      delete (fieldless as { fields?: unknown }).fields;
      const readModel = new ReadModel([collection('users', [column('id')], [fieldless])]);

      const { collections } = await collect(readModel);

      expect(collections[0].actions).toEqual([{ name: 'Ban', fields: [] }]);
    });

    it('should leave out an action with no endpoint, which the BFF does not expose', async () => {
      const endpointless = { ...action('Ban', ''), endpoint: undefined } as unknown as ReturnType<
        typeof action
      >;
      const readModel = new ReadModel([collection('users', [column('id')], [endpointless])]);

      const { collections } = await collect(readModel);

      expect(collections[0].actions).toEqual([]);
    });
  });

  describe('determinism', () => {
    it('should order relations by code unit, not by the process locale', async () => {
      // `localeCompare` would put `ärenden` first under en-US and last under code units, so the CLI
      // and the route could order one schema differently and stop producing the same document.
      const readModel = new ReadModel([
        collection('users', [
          relation('zulu', 'HasMany', 'target.id'),
          relation('ärenden', 'HasMany', 'target.id'),
          relation('orders', 'HasMany', 'target.id'),
        ]),
        collection('target', [column('id')]),
      ]);

      const { collections } = await collect(readModel);

      expect(collections[1].relations.map(entry => entry.name)).toEqual([
        'orders',
        'zulu',
        'ärenden',
      ]);
    });

    it('should sort collections, relations and actions by name', async () => {
      const readModel = new ReadModel([
        collection(
          'zulu',
          [relation('beta', 'HasMany', 'alpha.id'), relation('alpha', 'HasMany', 'alpha.id')],
          [action('zeta', '/z'), action('alpha', '/a')],
        ),
        collection('alpha', [column('id')]),
      ]);

      const { collections } = await collect(readModel);

      expect(collections.map(entry => entry.name)).toEqual(['alpha', 'zulu']);
      expect(collections[1].relations.map(entry => entry.name)).toEqual(['alpha', 'beta']);
      expect(collections[1].actions.map(entry => entry.name)).toEqual(['alpha', 'zeta']);
    });
  });

  describe('concurrency', () => {
    it('should never have more capabilities calls in flight than the cap', async () => {
      const readModel = new ReadModel(
        Array.from({ length: 12 }, (_, index) => collection(`c${index}`, [column('id')])),
      );
      let inFlight = 0;
      let peak = 0;

      const { collections } = await collect(readModel, {
        concurrency: 3,
        capabilities: async () => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await new Promise(resolve => {
            setImmediate(resolve);
          });
          inFlight -= 1;

          return CAPABILITIES;
        },
      });

      expect(collections).toHaveLength(12);
      expect(peak).toBe(3);
    });
  });
});
