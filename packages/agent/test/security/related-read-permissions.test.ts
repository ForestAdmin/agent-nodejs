import type { DataSource } from '@forestadmin/datasource-toolkit';

import { CollectionActionEvent } from '@forestadmin/forestadmin-client';
import { createMockContext } from '@shopify/jest-koa-mocks';

import Chart from '../../src/routes/access/chart';
import Count from '../../src/routes/access/count';
import Csv from '../../src/routes/access/csv';
import Get from '../../src/routes/access/get';
import List from '../../src/routes/access/list';
import AuthorizationService from '../../src/services/authorization/authorization';
import * as factories from '../__factories__';

describe('read permissions on related collections', () => {
  const options = factories.forestAdminHttpDriverOptions.build();

  const buildDataSource = (): DataSource =>
    factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'cards',
        schema: factories.collectionSchema.build({
          searchable: true,
          countable: true,
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            panLast4: factories.columnSchema.build({ columnType: 'String' }),
            accountId: factories.columnSchema.build({ columnType: 'Uuid' }),
            holderId: factories.columnSchema.build({ columnType: 'Uuid' }),
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
            id: factories.columnSchema.uuidPrimaryKey().build(),
            iban: factories.columnSchema.build({ columnType: 'String' }),
            balance: factories.columnSchema.build({ columnType: 'Number' }),
            organizationId: factories.columnSchema.build({ columnType: 'Uuid' }),
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
            id: factories.columnSchema.uuidPrimaryKey().build(),
            name: factories.columnSchema.build({ columnType: 'String' }),
          },
        }),
      }),
      factories.collection.build({
        name: 'holders',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            fullName: factories.columnSchema.text().build(),
            nationalId: factories.columnSchema.text().build(),
            cards: factories.oneToManySchema.build({
              foreignCollection: 'cards',
              originKey: 'holderId',
              originKeyTarget: 'id',
            }),
          },
        }),
      }),
    ]);

  const buildServices = (readableCollections: string[] = []) => {
    const forestAdminClient = factories.forestAdminClient.build();

    (forestAdminClient.permissionService.canOnCollection as jest.Mock).mockImplementation(
      ({ event, collectionName }) =>
        collectionName === 'cards' ||
        (event === CollectionActionEvent.Read && readableCollections.includes(collectionName)),
    );

    const services = factories.forestAdminHttpDriverServices.build();
    services.authorization = new AuthorizationService(forestAdminClient);
    services.serializer.serialize = jest.fn();
    services.serializer.serializeWithSearchMetadata = jest.fn();

    return services;
  };

  const buildContext = (
    customProperties: Record<string, unknown>,
    headers = {},
    requestBody?: unknown,
  ) =>
    createMockContext({
      headers,
      requestBody,
      state: { user: { id: 35, renderingId: 42, email: 'operator@domain.com' } },
      customProperties: {
        ...customProperties,
        query: { timezone: 'Europe/Paris', ...(customProperties.query as object) },
      },
    });

  describe('projection the caller named', () => {
    it('should refuse the request and name every offending field at once', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      const list = jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([]);

      await expect(
        new List(services, options, dataSource, 'cards').handleList(
          buildContext({}, { 'forest-projection': 'id,holder:nationalId,account:iban' }),
        ),
      ).rejects.toThrow(
        "You are not allowed to read 'holder:nationalId' from the 'holders' collection, " +
          "'account:iban' from the 'accounts' collection.",
      );

      expect(list).not.toHaveBeenCalled();
    });

    it('should refuse a named field on a get-one too', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();

      await expect(
        new Get(services, options, dataSource, 'cards').handleGet(
          buildContext(
            { params: { id: '2d162303-78bf-599e-b197-93590ac3d315' } },
            { 'forest-projection': 'id,holder:fullName' },
          ),
        ),
      ).rejects.toThrow("You are not allowed to read 'holder:fullName' from the 'holders'");
    });

    it('should refuse fields named through the fields[] query params', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();

      await expect(
        new List(services, options, dataSource, 'cards').handleList(
          buildContext({
            query: { 'fields[cards]': 'id,holder', 'fields[holder]': 'nationalId' },
          }),
        ),
      ).rejects.toThrow("You are not allowed to read 'holder:nationalId' from the 'holders'");
    });

    it('should serve a named field on a collection the caller can read', async () => {
      const dataSource = buildDataSource();
      const services = buildServices(['holders']);
      const list = jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([]);

      await new List(services, options, dataSource, 'cards').handleList(
        buildContext({}, { 'forest-projection': 'id,holder:nationalId' }),
      );

      expect([...list.mock.calls[0][2]].sort()).toEqual(['holder:id', 'holder:nationalId', 'id']);
    });

    it('should traverse a collection it cannot read to reach a column it can', async () => {
      const dataSource = buildDataSource();
      const services = buildServices(['organizations']);
      const list = jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([]);

      await new List(services, options, dataSource, 'cards').handleList(
        buildContext({}, { 'forest-projection': 'id,account:organization:name' }),
      );

      // The `account:` primary keys `withPks` re-adds are already on the row as `cards.accountId`.
      expect([...list.mock.calls[0][2]].sort()).toEqual([
        'account:id',
        'account:organization:id',
        'account:organization:name',
        'id',
      ]);
    });
  });

  describe('projection the caller never asked for', () => {
    it('should redact rather than refuse, so an ordinary listing keeps working', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      const list = jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([]);

      await new List(services, options, dataSource, 'cards').handleList(buildContext({}));

      expect(list.mock.calls[0][2].sort()).toEqual(['accountId', 'holderId', 'id', 'panLast4']);
    });
  });

  describe('filter', () => {
    const oracleFilter = JSON.stringify({
      field: 'holder:nationalId',
      operator: 'starts_with',
      value: '1850',
    });

    it('should refuse a filter reading a collection the caller cannot read', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      const list = jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([]);

      await expect(
        new List(services, options, dataSource, 'cards').handleList(
          buildContext({ query: { filters: oracleFilter } }),
        ),
      ).rejects.toThrow(
        "You cannot filter on 'holder:nationalId': you are not allowed to read the " +
          "'holders' collection.",
      );

      expect(list).not.toHaveBeenCalled();
    });

    it('should refuse the same filter on the count route', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      const aggregate = jest.spyOn(dataSource.getCollection('cards'), 'aggregate');

      await expect(
        new Count(services, options, dataSource, 'cards').handleCount(
          buildContext({ query: { filters: oracleFilter } }),
        ),
      ).rejects.toThrow("you are not allowed to read the 'holders' collection");

      expect(aggregate).not.toHaveBeenCalled();
    });

    it('should accept a filter reading a collection the caller can read', async () => {
      const dataSource = buildDataSource();
      const services = buildServices(['holders']);
      const list = jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([]);

      await new List(services, options, dataSource, 'cards').handleList(
        buildContext({ query: { filters: oracleFilter } }),
      );

      expect(list).toHaveBeenCalled();
    });

    it('should not check the scope, which the agent injects rather than the caller', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      const list = jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([]);

      jest
        .spyOn(services.authorization, 'getScope')
        .mockResolvedValue(
          factories.conditionTreeLeaf.build({ field: 'holder:nationalId', value: '1850' }),
        );

      await new List(services, options, dataSource, 'cards').handleList(buildContext({}));

      expect(list).toHaveBeenCalled();
    });
  });

  describe('sort', () => {
    it('should refuse a sort reading a collection the caller cannot read', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();

      await expect(
        new List(services, options, dataSource, 'cards').handleList(
          buildContext({ query: { sort: '-account.balance' } }),
        ),
      ).rejects.toThrow(
        "You cannot sort on 'account:balance': you are not allowed to read the " +
          "'accounts' collection.",
      );
    });
  });

  describe('extended search', () => {
    it('should refuse an extended search when a to-one relation cannot be read', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();

      await expect(
        new List(services, options, dataSource, 'cards').handleList(
          buildContext({ query: { search: 'martin', searchExtended: '1' } }),
        ),
      ).rejects.toThrow('you are not allowed to read the');
    });

    it('should refuse a search naming a relation column through the dot syntax', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      const aggregate = jest.spyOn(dataSource.getCollection('cards'), 'aggregate');

      await expect(
        new Count(services, options, dataSource, 'cards').handleCount(
          buildContext({ query: { search: 'holder.nationalId:1850' } }),
        ),
      ).rejects.toThrow(
        "You cannot search on 'holder:nationalId': you are not allowed to read the " +
          "'holders' collection.",
      );

      expect(aggregate).not.toHaveBeenCalled();
    });

    it('should refuse a search reaching a denied collection across a to-many relation', async () => {
      const dataSource = buildDataSource();
      const forestAdminClient = factories.forestAdminClient.build();
      const services = factories.forestAdminHttpDriverServices.build();
      services.authorization = new AuthorizationService(forestAdminClient);
      services.serializer.serializeWithSearchMetadata = jest.fn();

      // Searching from `holders`, so `cards` is the denied one here.
      (forestAdminClient.permissionService.canOnCollection as jest.Mock).mockImplementation(
        ({ collectionName }) => collectionName !== 'cards',
      );

      await expect(
        new List(services, options, dataSource, 'holders').handleList(
          buildContext({ query: { search: 'cards.panLast4:4242' } }),
        ),
      ).rejects.toThrow(
        "You cannot search on 'cards:panLast4': you are not allowed to read the " +
          "'cards' collection.",
      );
    });

    it('should accept a plain search, which never leaves the root collection', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      const list = jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([]);

      await new List(services, options, dataSource, 'cards').handleList(
        buildContext({ query: { search: 'martin' } }),
      );

      expect(list).toHaveBeenCalled();
    });

    it('should accept an extended search once every to-one relation is readable', async () => {
      const dataSource = buildDataSource();
      const services = buildServices(['holders', 'accounts']);
      const list = jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([]);

      await new List(services, options, dataSource, 'cards').handleList(
        buildContext({ query: { search: 'martin', searchExtended: '1' } }),
      );

      expect(list).toHaveBeenCalled();
    });
  });

  describe('csv export', () => {
    it('should refuse an export naming a column of an unreadable collection', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();

      const context = buildContext({
        query: {
          header: 'Id,Holder national id',
          'fields[cards]': 'id,holder',
          'fields[holder]': 'nationalId',
        },
      });

      await expect(
        new Csv(services, options, dataSource, 'cards').handleCsv(context),
      ).rejects.toThrow("You are not allowed to read 'holder:nationalId' from the 'holders'");
    });
  });

  describe('chart', () => {
    it('should refuse to group a chart by a column of an unreadable collection', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      const body = {
        type: 'Pie',
        aggregator: 'Count',
        groupByFieldName: 'holder:fullName',
      };

      (services.chartHandler.getChartWithContextInjected as jest.Mock).mockResolvedValue(body);

      await expect(
        new Chart(services, options, dataSource, 'cards').handleChart(buildContext({}, {}, body)),
      ).rejects.toThrow(
        "You cannot group a chart by 'holder:fullName': you are not allowed to read the " +
          "'holders' collection.",
      );
    });

    it('should assert browse on the collection a leaderboard counts, which no field names', async () => {
      const dataSource = buildDataSource();
      const forestAdminClient = factories.forestAdminClient.build();
      const services = factories.forestAdminHttpDriverServices.build();
      services.authorization = new AuthorizationService(forestAdminClient);
      const body = {
        type: 'Leaderboard',
        aggregator: 'Count',
        relationshipFieldName: 'cards',
        labelFieldName: 'fullName',
        limit: 5,
      };

      (forestAdminClient.permissionService.canOnCollection as jest.Mock).mockResolvedValue(true);
      (services.chartHandler.getChartWithContextInjected as jest.Mock).mockResolvedValue(body);
      jest.spyOn(dataSource.getCollection('cards'), 'aggregate').mockResolvedValue([]);

      await new Chart(services, options, dataSource, 'holders').handleChart(
        buildContext({}, {}, body),
      );

      expect(forestAdminClient.permissionService.canOnCollection).toHaveBeenCalledWith({
        userId: 35,
        event: CollectionActionEvent.Browse,
        collectionName: 'cards',
      });
    });
  });
});
