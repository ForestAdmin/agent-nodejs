import type { DataSource } from '@forestadmin/datasource-toolkit';
import type { Readable } from 'stream';

import { createMockContext } from '@shopify/jest-koa-mocks';

import Chart from '../../src/routes/access/chart';
import Csv from '../../src/routes/access/csv';
import CsvRelated from '../../src/routes/access/csv-related';
import Get from '../../src/routes/access/get';
import List from '../../src/routes/access/list';
import ListRelated from '../../src/routes/access/list-related';
import Update from '../../src/routes/modification/update';
import AuthorizationService from '../../src/services/authorization/authorization';
import * as factories from '../__factories__';

describe('scopes on related collections', () => {
  const options = factories.forestAdminHttpDriverOptions.build();

  const buildDataSource = (): DataSource => {
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'cards',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.numericPrimaryKey().build(),
            accountId: factories.columnSchema.build({ columnType: 'Number' }),
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
            iban: factories.columnSchema.build({ columnType: 'String' }),
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
            name: factories.columnSchema.build({ columnType: 'String' }),
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
            status: factories.columnSchema.build({ columnType: 'String' }),
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
});
