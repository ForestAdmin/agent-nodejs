import type { CollectionDecorator, DataSource } from '@forestadmin/datasource-toolkit';

import { CollectionActionEvent } from '@forestadmin/forestadmin-client';
import { createMockContext } from '@shopify/jest-koa-mocks';

import Chart from '../../src/routes/access/chart';
import Count from '../../src/routes/access/count';
import CountRelated from '../../src/routes/access/count-related';
import Csv from '../../src/routes/access/csv';
import CsvRelated from '../../src/routes/access/csv-related';
import Get from '../../src/routes/access/get';
import List from '../../src/routes/access/list';
import ListRelated from '../../src/routes/access/list-related';
import Update from '../../src/routes/modification/update';
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
            iban: factories.columnSchema.text().build(),
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

      // `withPks` runs after the check and re-adds a key per surviving relation, so `account:id`
      // comes back from a collection the caller cannot read. It carries nothing new only here,
      // where the ManyToOne targets the primary key and the row already holds it as
      // `cards.accountId`. A OneToOne, or a `foreignKeyTarget` that is not the primary key,
      // exposes a key the row does not carry.
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

      expect(list.mock.calls[0][1].conditionTree).toMatchObject({
        field: 'holder:nationalId',
        operator: 'StartsWith',
        value: '1850',
      });
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

      expect(list.mock.calls[0][1].conditionTree).toMatchObject({
        field: 'holder:nationalId',
        value: '1850',
      });
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
    it('should refuse whatever the stack says the search will reach', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      const cards = dataSource.getCollection('cards') as CollectionDecorator;
      const aggregate = jest.spyOn(cards, 'aggregate');

      cards.getSearchedFields = () => [{ path: 'holder:nationalId', collection: 'holders' }];

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

    it('should ask the stack with the extended flag the caller sent', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      const cards = dataSource.getCollection('cards') as CollectionDecorator;
      const getSearchedFields = jest.fn().mockReturnValue([]);
      cards.getSearchedFields = getSearchedFields;
      jest.spyOn(cards, 'list').mockResolvedValue([]);

      await new List(services, options, dataSource, 'cards').handleList(
        buildContext({ query: { search: 'martin', searchExtended: '1' } }),
      );

      expect(getSearchedFields).toHaveBeenCalledWith('martin', true);
    });

    it('should serve the request when the stack cannot say what a search reaches', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      const cards = dataSource.getCollection('cards') as CollectionDecorator;
      const list = jest.spyOn(cards, 'list').mockResolvedValue([]);

      // A replaced search: the handler picks the fields, the caller only supplies the text.
      cards.getSearchedFields = () => null;

      await new List(services, options, dataSource, 'cards').handleList(
        buildContext({ query: { search: 'martin', searchExtended: '1' } }),
      );

      expect(list.mock.calls[0][1]).toMatchObject({ search: 'martin', searchExtended: true });
    });

    it('should accept a plain search, which never leaves the root collection', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      const cards = dataSource.getCollection('cards') as CollectionDecorator;
      const list = jest.spyOn(cards, 'list').mockResolvedValue([]);

      cards.getSearchedFields = () => [{ path: 'panLast4', collection: 'cards' }];

      await new List(services, options, dataSource, 'cards').handleList(
        buildContext({ query: { search: 'martin' } }),
      );

      expect(list.mock.calls[0][1]).toMatchObject({ search: 'martin', searchExtended: false });
    });

    it('should accept an extended search once every to-one relation is readable', async () => {
      const dataSource = buildDataSource();
      const services = buildServices(['holders', 'accounts']);
      const cards = dataSource.getCollection('cards') as CollectionDecorator;
      const list = jest.spyOn(cards, 'list').mockResolvedValue([]);

      cards.getSearchedFields = () => [
        { path: 'panLast4', collection: 'cards' },
        { path: 'holder:fullName', collection: 'holders' },
        { path: 'account:iban', collection: 'accounts' },
      ];

      await new List(services, options, dataSource, 'cards').handleList(
        buildContext({ query: { search: 'martin', searchExtended: '1' } }),
      );

      expect(list.mock.calls[0][1]).toMatchObject({ search: 'martin', searchExtended: true });
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

  // `edit` is the entry point here, not `read`: the route re-lists the row it just wrote with a
  // projection the caller never supplied, so the same disclosure is one HTTP verb away.
  describe('update', () => {
    const updateContext = () =>
      buildContext(
        { params: { id: '2d162303-78bf-599e-b197-93590ac3d315' } },
        {},
        {
          data: {
            id: '2d162303-78bf-599e-b197-93590ac3d315',
            attributes: { panLast4: '4242' },
          },
        },
      );

    it('should redact the record it serializes back rather than refusing the write', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      const cards = dataSource.getCollection('cards');
      cards.update = jest.fn();
      const list = jest.spyOn(cards, 'list').mockResolvedValue([{ id: 'a-card' }]);

      await new Update(services, options, dataSource, 'cards').handleUpdate(updateContext());

      expect([...list.mock.calls[0][2]].sort()).toEqual([
        'accountId',
        'holderId',
        'id',
        'panLast4',
      ]);
    });

    it('should keep the columns of a collection the caller may read', async () => {
      const dataSource = buildDataSource();
      const services = buildServices(['holders']);
      const cards = dataSource.getCollection('cards');
      cards.update = jest.fn();
      const list = jest.spyOn(cards, 'list').mockResolvedValue([{ id: 'a-card' }]);

      await new Update(services, options, dataSource, 'cards').handleUpdate(updateContext());

      expect([...list.mock.calls[0][2]].sort()).toEqual([
        'accountId',
        'holder:fullName',
        'holder:id',
        'holder:nationalId',
        'holderId',
        'id',
        'panLast4',
      ]);
    });
  });

  // The related routes are the only sites resolving against `foreignCollection` rather than the
  // route's own collection, so a swap between the two would otherwise go unnoticed.
  describe('related routes', () => {
    const holderCardsContext = () =>
      buildContext({
        params: { parentId: '2d162303-78bf-599e-b197-93590ac3d315' },
        query: {
          filters: JSON.stringify({
            field: 'account:iban',
            operator: 'equal',
            value: 'FR76',
          }),
        },
      });

    it('should refuse a filter on a denied collection reached from the related list', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();

      await expect(
        new ListRelated(services, options, dataSource, 'holders', 'cards').handleListRelated(
          holderCardsContext(),
        ),
      ).rejects.toThrow(
        "You cannot filter on 'account:iban': you are not allowed to read the " +
          "'accounts' collection.",
      );
    });

    it('should refuse the same filter on the related export', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();

      await expect(
        new CsvRelated(services, options, dataSource, 'holders', 'cards').handleRelatedCsv(
          holderCardsContext(),
        ),
      ).rejects.toThrow("you are not allowed to read the 'accounts' collection");
    });

    it('should refuse the same filter on the related count', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();

      await expect(
        new CountRelated(services, options, dataSource, 'holders', 'cards').handleCountRelated(
          holderCardsContext(),
        ),
      ).rejects.toThrow("you are not allowed to read the 'accounts' collection");
    });

    it('should redact the related list projection rather than refuse it', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      const list = jest.spyOn(dataSource.getCollection('cards'), 'list').mockResolvedValue([]);

      await new ListRelated(services, options, dataSource, 'holders', 'cards').handleListRelated(
        buildContext({ params: { parentId: '2d162303-78bf-599e-b197-93590ac3d315' } }),
      );

      expect(list.mock.calls[0][2].sort()).toEqual(['accountId', 'holderId', 'id', 'panLast4']);
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

    it('should refuse a line chart grouped by a column of an unreadable collection', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      const body = {
        type: 'Line',
        aggregator: 'Count',
        groupByFieldName: 'holder:fullName',
        timeRange: 'Day',
      };

      (services.chartHandler.getChartWithContextInjected as jest.Mock).mockResolvedValue(body);

      await expect(
        new Chart(services, options, dataSource, 'cards').handleChart(buildContext({}, {}, body)),
      ).rejects.toThrow(
        "You cannot group a chart by 'holder:fullName': you are not allowed to read the " +
          "'holders' collection.",
      );
    });

    it('should refuse a value chart aggregating a column of an unreadable collection', async () => {
      const dataSource = buildDataSource();
      const services = buildServices();
      const body = { type: 'Value', aggregator: 'Sum', aggregateFieldName: 'account:balance' };

      (services.chartHandler.getChartWithContextInjected as jest.Mock).mockResolvedValue(body);

      await expect(
        new Chart(services, options, dataSource, 'cards').handleChart(buildContext({}, {}, body)),
      ).rejects.toThrow(
        "You cannot aggregate a chart on 'account:balance': you are not allowed to read the " +
          "'accounts' collection.",
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
