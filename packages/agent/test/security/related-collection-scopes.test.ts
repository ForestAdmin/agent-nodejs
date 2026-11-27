import type { DataSource, Operator } from '@forestadmin/datasource-toolkit';
import type { Readable } from 'stream';

import { ForbiddenError } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import Chart from '../../src/routes/access/chart';
import Count from '../../src/routes/access/count';
import CountRelated from '../../src/routes/access/count-related';
import Csv from '../../src/routes/access/csv';
import CsvRelated from '../../src/routes/access/csv-related';
import Get from '../../src/routes/access/get';
import List from '../../src/routes/access/list';
import ListRelated from '../../src/routes/access/list-related';
import ActionRoute from '../../src/routes/modification/action/action';
import Delete from '../../src/routes/modification/delete';
import DissociateDeleteRelated from '../../src/routes/modification/dissociate-delete-related';
import Update from '../../src/routes/modification/update';
import AuthorizationService from '../../src/services/authorization/authorization';
import * as factories from '../__factories__';

describe('scopes on related collections', () => {
  const options = factories.forestAdminHttpDriverOptions.build();

  const filterOperators = new Set<Operator>(['Equal', 'Missing']);

  const buildDataSource = (): DataSource => {
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'cards',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.numericPrimaryKey().build(),
            accountId: factories.columnSchema.build({ columnType: 'Number', filterOperators }),
            holderId: factories.columnSchema.build({ columnType: 'Number' }),
            account: factories.manyToOneSchema.build({
              foreignCollection: 'accounts',
              foreignKey: 'accountId',
            }),
            holder: factories.manyToOneSchema.build({
              foreignCollection: 'holders',
              foreignKey: 'holderId',
            }),
          },
        }),
      }),
      factories.collection.build({
        name: 'accounts',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.numericPrimaryKey().build(),
            iban: factories.columnSchema.build({ columnType: 'String', filterOperators }),
            organizationId: factories.columnSchema.build({ columnType: 'Number' }),
            organization: factories.manyToOneSchema.build({
              foreignCollection: 'organizations',
              foreignKey: 'organizationId',
            }),
          },
        }),
      }),
      factories.collection.build({
        name: 'organizations',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.numericPrimaryKey().build(),
            name: factories.columnSchema.build({ columnType: 'String', filterOperators }),
            accounts: factories.oneToManySchema.build({
              foreignCollection: 'accounts',
              originKey: 'organizationId',
              originKeyTarget: 'id',
            }),
          },
        }),
      }),
      factories.collection.build({
        name: 'holders',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.numericPrimaryKey().build(),
            fullName: factories.columnSchema.build({ columnType: 'String' }),
            nationalId: factories.columnSchema.build({ columnType: 'String' }),
            region: factories.columnSchema.build({ columnType: 'String' }),
            cards: factories.oneToManySchema.build({
              foreignCollection: 'cards',
              originKey: 'holderId',
              originKeyTarget: 'id',
            }),
            membership: factories.oneToOneSchema.build({
              foreignCollection: 'memberships',
              originKey: 'holderId',
              originKeyTarget: 'id',
            }),
            organizations: factories.manyToManySchema.build({
              foreignCollection: 'organizations',
              throughCollection: 'memberships',
              originKey: 'holderId',
              originKeyTarget: 'id',
              foreignKey: 'organizationId',
              foreignKeyTarget: 'id',
            }),
          },
        }),
      }),
      factories.collection.build({
        name: 'memberships',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.numericPrimaryKey().build(),
            holderId: factories.columnSchema.build({ columnType: 'Number' }),
            organizationId: factories.columnSchema.build({ columnType: 'Number' }),
            status: factories.columnSchema.build({ columnType: 'String', filterOperators }),
            holder: factories.manyToOneSchema.build({
              foreignCollection: 'holders',
              foreignKey: 'holderId',
            }),
            organization: factories.manyToOneSchema.build({
              foreignCollection: 'organizations',
              foreignKey: 'organizationId',
            }),
          },
        }),
      }),
    ]);

    // The datasource answers which related records are in scope: accounts 10 and 30, holder 100.
    const inScope = { accounts: [10, 30], holders: [100] };
    Object.entries(inScope).forEach(([name, ids]) => {
      jest.spyOn(dataSource.getCollection(name), 'list').mockResolvedValue(ids.map(id => ({ id })));
    });

    return dataSource;
  };

  const scopes = {
    accounts: { field: 'organization:name', operator: 'equal', value: 'OwnOrg' },
    holders: { field: 'region', operator: 'equal', value: 'EU' },
    organizations: { field: 'name', operator: 'equal', value: 'OwnOrg' },
    memberships: { field: 'status', operator: 'equal', value: 'active' },
  };

  const buildServices = ({ flagged = true } = {}) => {
    const forestAdminClient = factories.forestAdminClient.build();

    (forestAdminClient.permissionService.canOnCollection as jest.Mock).mockResolvedValue(true);
    (forestAdminClient.getScope as jest.Mock).mockImplementation(
      async ({ collectionName }) => scopes[collectionName] ?? null,
    );
    (forestAdminClient.scopeAppliesToRelatedRecords as jest.Mock).mockResolvedValue(flagged);

    const services = factories.forestAdminHttpDriverServices.build();
    services.authorization = new AuthorizationService(forestAdminClient);
    services.serializer.serialize = jest.fn();
    services.serializer.serializeWithSearchMetadata = jest.fn();

    return services;
  };

  const buildContext = (customProperties: Record<string, unknown>, headers = {}, body?: unknown) =>
    createMockContext({
      headers,
      requestBody: body,
      state: { user: { id: 35, renderingId: 42, email: 'operator@domain.com' } },
      customProperties: {
        ...customProperties,
        query: { timezone: 'Europe/Paris', ...(customProperties.query as object) },
      },
    });

  const cards = [
    {
      id: 1,
      account: { id: 10, iban: 'FR76', organization: { name: 'OwnOrg' } },
      holder: { id: 100, nationalId: 'EU-1', region: 'EU' },
    },
    {
      id: 2,
      account: { id: 20, iban: 'DE22', organization: { name: 'AnotherTenant' } },
      holder: { id: 100, nationalId: 'EU-1', region: 'EU' },
    },
    {
      id: 3,
      account: { id: 30, iban: 'FR14', organization: { name: 'OwnOrg' } },
      holder: { id: 300, nationalId: 'US-3', region: 'US' },
    },
    { id: 4, account: null, holder: { id: 100, nationalId: 'EU-1', region: 'EU' } },
  ];
  const projectionHeader = { 'forest-projection': 'id,account:iban,holder:nationalId' };
  const exportQuery = {
    header: 'Id,Iban',
    'fields[cards]': 'id,account',
    'fields[account]': 'iban',
  };

  const readCsv = async (stream: Readable) => {
    let csv = '';
    for await (const chunk of stream) csv += chunk;

    return csv;
  };

  describe('list', () => {
    it('should fetch the key of each scoped related record', async () => {
      const dataSource = buildDataSource();
      const list = jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([]);

      await new List(buildServices(), options, dataSource, 'cards').handleList(
        buildContext({}, projectionHeader),
      );

      expect(list).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.arrayContaining(['account:id', 'holder:id']),
      );
    });

    it('should keep every card and empty the related records outside their scope', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue(cards);

      await new List(services, options, dataSource, 'cards').handleList(
        buildContext({}, projectionHeader),
      );

      expect(services.serializer.serializeWithSearchMetadata).toHaveBeenCalledWith(
        dataSource.getCollection('cards'),
        [
          { id: 1, account: { id: 10, iban: 'FR76' }, holder: { id: 100, nationalId: 'EU-1' } },
          { id: 2, account: null, holder: { id: 100, nationalId: 'EU-1' } },
          { id: 3, account: { id: 30, iban: 'FR14' }, holder: null },
          { id: 4, account: null, holder: { id: 100, nationalId: 'EU-1' } },
        ],
        null,
      );
    });
  });

  describe('when the related scopes are not flagged', () => {
    it('should serve the related records unchanged', async () => {
      const dataSource = buildDataSource();
      const services = buildServices({ flagged: false });
      jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue(cards);

      await new List(services, options, dataSource, 'cards').handleList(
        buildContext({}, projectionHeader),
      );

      expect(services.serializer.serializeWithSearchMetadata).toHaveBeenCalledWith(
        dataSource.getCollection('cards'),
        cards,
        null,
      );
    });

    it('should not query the related collections', async () => {
      const dataSource = buildDataSource();
      jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue(cards);

      await new List(buildServices({ flagged: false }), options, dataSource, 'cards').handleList(
        buildContext({}, projectionHeader),
      );

      expect(dataSource.getCollection('accounts').list).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should serve the card with its out-of-scope account emptied', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([cards[1]]);

      await new Get(services, options, dataSource, 'cards').handleGet(
        buildContext({ params: { id: '2' } }, projectionHeader),
      );

      expect(services.serializer.serialize).toHaveBeenCalledWith(
        dataSource.getCollection('cards'),
        { id: 2, account: null, holder: { id: 100, nationalId: 'EU-1' } },
      );
    });
  });

  describe('update', () => {
    it('should serve the updated card with its out-of-scope account emptied', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      services.serializer.deserialize = jest.fn().mockReturnValue({ id: 2 });
      jest.spyOn(dataSource.getCollection('cards'), 'update').mockResolvedValue();
      jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([cards[1]]);

      await new Update(services, options, dataSource, 'cards').handleUpdate(
        buildContext({ params: { id: '2' } }, {}, { data: { attributes: {} } }),
      );

      expect(services.serializer.serialize).toHaveBeenCalledWith(
        dataSource.getCollection('cards'),
        expect.objectContaining({ id: 2, account: null }),
      );
    });
  });

  describe('csv', () => {
    it('should leave the cells of an out-of-scope related record empty', async () => {
      const dataSource = buildDataSource();
      const context = buildContext({ query: exportQuery });
      jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue(cards.slice(0, 2));

      await new Csv(buildServices(), options, dataSource, 'cards').handleCsv(context);

      expect(await readCsv(context.response.body as Readable)).toEqual('Id,Iban\n1,FR76\n2,\n');
    });
  });

  describe('related routes', () => {
    it('should empty the out-of-scope records reached from the related collection', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([cards[1]]);

      await new ListRelated(services, options, dataSource, 'holders', 'cards').handleListRelated(
        buildContext({ params: { parentId: '100' } }, projectionHeader),
      );

      expect(services.serializer.serializeWithSearchMetadata).toHaveBeenCalledWith(
        dataSource.getCollection('cards'),
        [{ id: 2, account: null, holder: { id: 100, nationalId: 'EU-1' } }],
        null,
      );
    });

    it('should leave the out-of-scope cells empty in a related export', async () => {
      const dataSource = buildDataSource();
      const context = buildContext({ params: { parentId: '100' }, query: exportQuery });
      jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue(cards.slice(0, 2));

      await new CsvRelated(
        buildServices(),
        options,
        dataSource,
        'holders',
        'cards',
      ).handleRelatedCsv(context);

      expect(await readCsv(context.response.body as Readable)).toEqual('Id,Iban\n1,FR76\n2,\n');
    });
  });

  describe('leaderboard', () => {
    const leaderboard = (relationshipFieldName: string, labelFieldName: string) => ({
      type: 'Leaderboard',
      aggregator: 'Count',
      relationshipFieldName,
      labelFieldName,
      limit: 5,
    });

    it('should apply the scope of the aggregated one-to-many collection', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      const body = leaderboard('accounts', 'name');
      (services.chartHandler.getChartWithContextInjected as jest.Mock).mockResolvedValue(body);
      scopes.organizations.value = 'Root';
      const aggregate = jest
        .spyOn(dataSource.getCollection('accounts'), 'aggregate')
        .mockResolvedValue([]);

      await new Chart(services, options, dataSource, 'organizations').handleChart(
        buildContext({}, {}, body),
      );
      scopes.organizations.value = 'OwnOrg';

      expect(aggregate.mock.calls[0][1].conditionTree).toEqual(
        expect.objectContaining({
          aggregator: 'And',
          conditions: [
            expect.objectContaining({ field: 'organization:name', value: 'Root' }),
            expect.objectContaining({ field: 'organization:name', value: 'OwnOrg' }),
          ],
        }),
      );
    });

    it('should aggregate under the root scope only when the aggregated scope is not flagged', async () => {
      const dataSource = buildDataSource();
      const services = buildServices({ flagged: false });
      const body = leaderboard('accounts', 'name');
      (services.chartHandler.getChartWithContextInjected as jest.Mock).mockResolvedValue(body);
      scopes.organizations.value = 'Root';
      const aggregate = jest
        .spyOn(dataSource.getCollection('accounts'), 'aggregate')
        .mockResolvedValue([]);

      await new Chart(services, options, dataSource, 'organizations').handleChart(
        buildContext({}, {}, body),
      );
      scopes.organizations.value = 'OwnOrg';

      expect(aggregate.mock.calls[0][1].conditionTree).toEqual(
        expect.objectContaining({ field: 'organization:name', value: 'Root' }),
      );
    });

    it('should apply the scopes of the through and foreign collections of a many-to-many', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      const body = leaderboard('organizations', 'fullName');
      (services.chartHandler.getChartWithContextInjected as jest.Mock).mockResolvedValue(body);
      const aggregate = jest
        .spyOn(dataSource.getCollection('memberships'), 'aggregate')
        .mockResolvedValue([]);

      await new Chart(services, options, dataSource, 'holders').handleChart(
        buildContext({}, {}, body),
      );

      expect(aggregate.mock.calls[0][1].conditionTree).toEqual(
        expect.objectContaining({
          aggregator: 'And',
          conditions: [
            expect.objectContaining({ field: 'holder:region', value: 'EU' }),
            expect.objectContaining({ field: 'status', value: 'active' }),
            expect.objectContaining({ field: 'organization:name', value: 'OwnOrg' }),
          ],
        }),
      );
    });
  });

  describe('filters, sorts and searches through a scoped relation', () => {
    const filterOn = (field: string, value: unknown = 'FR76') => ({
      filters: JSON.stringify({ field, operator: 'equal', value }),
    });
    const inScopeOrNoAccount = {
      aggregator: 'Or',
      conditions: [
        { field: 'account:organization:name', operator: 'Equal', value: 'OwnOrg' },
        { field: 'accountId', operator: 'Missing' },
      ],
    };
    const listedTree = async (query: Record<string, unknown>, flagged = true) => {
      const dataSource = buildDataSource();
      const list = jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([]);

      await new List(buildServices({ flagged }), options, dataSource, 'cards').handleList(
        buildContext({ query }, projectionHeader),
      );

      return list.mock.calls[0][1].conditionTree?.toPlainObject();
    };
    const excludedFrom = (filter: unknown) =>
      (filter as { searchExcludedCollections?: string[] }).searchExcludedCollections;
    const holdsRestriction = (tree: unknown) =>
      JSON.stringify(tree).includes('{"field":"accountId","operator":"Missing"}');

    it('should match a card only when its account is in scope or absent', async () => {
      expect(await listedTree(filterOn('account:iban'))).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'account:iban', operator: 'Equal', value: 'FR76' },
          inScopeOrNoAccount,
        ],
      });
    });

    it('should restrict a condition on each scoped relation it crosses', async () => {
      expect(await listedTree(filterOn('account:organization:name', 'OwnOrg'))).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'account:organization:name', operator: 'Equal', value: 'OwnOrg' },
          inScopeOrNoAccount,
          {
            aggregator: 'Or',
            conditions: [
              { field: 'account:organization:name', operator: 'Equal', value: 'OwnOrg' },
              { field: 'account:organizationId', operator: 'Missing' },
            ],
          },
        ],
      });
    });

    it('should match a holder only when its one-to-one membership is in scope or absent', async () => {
      const dataSource = buildDataSource();
      const list = jest.spyOn(dataSource.getCollection('holders'), 'list').mockResolvedValue([]);

      await new List(buildServices(), options, dataSource, 'holders').handleList(
        buildContext({ query: filterOn('membership:status', 'active') }),
      );

      expect(list.mock.calls[0][1].conditionTree.toPlainObject()).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'membership:status', operator: 'Equal', value: 'active' },
          {
            aggregator: 'Or',
            conditions: [
              { field: 'membership:status', operator: 'Equal', value: 'active' },
              { field: 'membership:id', operator: 'Missing' },
            ],
          },
          { field: 'region', operator: 'Equal', value: 'EU' },
        ],
      });
    });

    it('should leave a condition on the card itself unchanged', async () => {
      expect(await listedTree(filterOn('accountId', 20))).toEqual({
        field: 'accountId',
        operator: 'Equal',
        value: 20,
      });
    });

    it('should leave the condition unchanged when the related scope is not flagged', async () => {
      expect(await listedTree(filterOn('account:iban'), false)).toEqual({
        field: 'account:iban',
        operator: 'Equal',
        value: 'FR76',
      });
    });

    it("should keep the card's own scope as written", async () => {
      (scopes as Record<string, unknown>).cards = {
        field: 'account:iban',
        operator: 'equal',
        value: 'FR76',
      };

      try {
        expect(await listedTree({})).toEqual({
          field: 'account:iban',
          operator: 'Equal',
          value: 'FR76',
        });
      } finally {
        delete (scopes as Record<string, unknown>).cards;
      }
    });

    it('should count only the cards whose account is in scope or absent', async () => {
      const dataSource = buildDataSource();
      const aggregate = jest
        .spyOn(dataSource.getCollection('cards'), 'aggregate')
        .mockResolvedValue([{ value: 1, group: {} }]);

      await new Count(buildServices(), options, dataSource, 'cards').handleCount(
        buildContext({ query: filterOn('account:iban') }),
      );

      expect(aggregate.mock.calls[0][1].conditionTree.toPlainObject()).toEqual({
        aggregator: 'And',
        conditions: [
          { field: 'account:iban', operator: 'Equal', value: 'FR76' },
          inScopeOrNoAccount,
        ],
      });
    });

    it('should refuse a sort through a scoped relation', async () => {
      const dataSource = buildDataSource();
      jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([]);

      await expect(
        new List(buildServices(), options, dataSource, 'cards').handleList(
          buildContext({ query: { sort: 'account.iban' } }, projectionHeader),
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should sort through the relation when its scope is not flagged', async () => {
      const dataSource = buildDataSource();
      const list = jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([]);

      await new List(buildServices({ flagged: false }), options, dataSource, 'cards').handleList(
        buildContext({ query: { sort: 'account.iban' } }, projectionHeader),
      );

      expect(list.mock.calls[0][1].sort[0]).toEqual({ field: 'account:iban', ascending: true });
    });

    it('should tell the search which scoped collections to leave out', async () => {
      const dataSource = buildDataSource();
      const list = jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([]);
      dataSource.getCollection('cards').schema.searchable = true;

      await new List(buildServices(), options, dataSource, 'cards').handleList(
        buildContext({ query: { search: 'FR76' } }, projectionHeader),
      );

      expect([...excludedFrom(list.mock.calls[0][1])].sort()).toEqual([
        'accounts',
        'holders',
        'memberships',
        'organizations',
      ]);
    });

    it('should leave no collection out of the search when no scope is flagged', async () => {
      const dataSource = buildDataSource();
      const list = jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([]);
      dataSource.getCollection('cards').schema.searchable = true;

      await new List(buildServices({ flagged: false }), options, dataSource, 'cards').handleList(
        buildContext({ query: { search: 'FR76' } }, projectionHeader),
      );

      expect(excludedFrom(list.mock.calls[0][1]) ?? []).toEqual([]);
    });

    it('should leave out of a pie chart the cards whose account is hidden', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      const body = { type: 'Pie', aggregator: 'Count', groupByFieldName: 'account:iban' };
      (services.chartHandler.getChartWithContextInjected as jest.Mock).mockResolvedValue(body);
      const aggregate = jest
        .spyOn(dataSource.getCollection('cards'), 'aggregate')
        .mockResolvedValue([]);

      await new Chart(services, options, dataSource, 'cards').handleChart(
        buildContext({}, {}, body),
      );

      expect(aggregate.mock.calls[0][1].conditionTree.toPlainObject()).toEqual(inScopeOrNoAccount);
    });

    it('should run a bulk action only on the cards whose account is in scope or absent', async () => {
      const dataSource = buildDataSource();
      dataSource.getCollection('cards').schema.actions = {
        Freeze: { scope: 'Bulk', staticForm: true },
      };
      const route = new ActionRoute(buildServices(), options, dataSource, 'cards', 'Freeze');
      const body = {
        data: {
          attributes: {
            all_records: true,
            all_records_ids_excluded: [],
            all_records_subset_query: filterOn('account:iban'),
          },
        },
      };

      // @ts-expect-error: the selection is private to the route
      const filter = await route.getRecordSelection(buildContext({}, {}, body));

      expect(holdsRestriction(filter.conditionTree.toPlainObject())).toBe(true);
    });

    it('should leave out of a value chart the cards whose account is hidden', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      const body = {
        type: 'Value',
        aggregator: 'Sum',
        aggregateFieldName: 'account:organizationId',
      };
      (services.chartHandler.getChartWithContextInjected as jest.Mock).mockResolvedValue(body);
      const aggregate = jest
        .spyOn(dataSource.getCollection('cards'), 'aggregate')
        .mockResolvedValue([]);

      await new Chart(services, options, dataSource, 'cards').handleChart(
        buildContext({}, {}, body),
      );

      expect(aggregate.mock.calls[0][1].conditionTree.toPlainObject()).toEqual(inScopeOrNoAccount);
    });

    it('should list only the related cards whose account is in scope or absent', async () => {
      const dataSource = buildDataSource();
      const list = jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([]);

      await new ListRelated(
        buildServices(),
        options,
        dataSource,
        'holders',
        'cards',
      ).handleListRelated(
        buildContext(
          { params: { parentId: '100' }, query: filterOn('account:iban') },
          projectionHeader,
        ),
      );

      expect(holdsRestriction(list.mock.calls[0][1].conditionTree.toPlainObject())).toBe(true);
    });

    it('should count only the related cards whose account is in scope or absent', async () => {
      const dataSource = buildDataSource();
      const aggregate = jest
        .spyOn(dataSource.getCollection('cards'), 'aggregate')
        .mockResolvedValue([]);

      await new CountRelated(
        buildServices(),
        options,
        dataSource,
        'holders',
        'cards',
      ).handleCountRelated(
        buildContext({ params: { parentId: '100' }, query: filterOn('account:iban') }),
      );

      expect(holdsRestriction(aggregate.mock.calls[0][1].conditionTree.toPlainObject())).toBe(true);
    });

    it('should export only the cards whose account is in scope or absent', async () => {
      const dataSource = buildDataSource();
      const list = jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([]);
      const context = buildContext({ query: { ...exportQuery, ...filterOn('account:iban') } });

      await new Csv(buildServices(), options, dataSource, 'cards').handleCsv(context);
      await readCsv(context.response.body as Readable);

      expect(holdsRestriction(list.mock.calls[0][1].conditionTree.toPlainObject())).toBe(true);
    });

    it('should delete only the cards whose account is in scope or absent', async () => {
      const dataSource = buildDataSource();
      const remove = jest.spyOn(dataSource.getCollection('cards'), 'delete').mockResolvedValue();
      const body = {
        data: {
          attributes: {
            all_records: true,
            all_records_ids_excluded: [],
            all_records_subset_query: filterOn('account:iban'),
          },
        },
      };

      await new Delete(buildServices(), options, dataSource, 'cards').handleListDelete(
        buildContext({}, {}, body),
      );

      expect(holdsRestriction(remove.mock.calls[0][1].conditionTree.toPlainObject())).toBe(true);
    });

    it('should delete only the related cards whose account is in scope or absent', async () => {
      const dataSource = buildDataSource();
      const remove = jest.spyOn(dataSource.getCollection('cards'), 'delete').mockResolvedValue();
      const body = {
        data: {
          attributes: {
            all_records: true,
            all_records_ids_excluded: [],
            all_records_subset_query: filterOn('account:iban'),
          },
        },
      };

      await new DissociateDeleteRelated(
        buildServices(),
        options,
        dataSource,
        'holders',
        'cards',
      ).handleDissociateDeleteRelatedRoute(
        buildContext({ params: { parentId: '100' }, query: { delete: 'true' } }, {}, body),
      );

      expect(holdsRestriction(remove.mock.calls[0][1].conditionTree.toPlainObject())).toBe(true);
    });
  });
});
