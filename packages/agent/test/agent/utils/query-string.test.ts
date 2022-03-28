import { ValidationError } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../__factories__';
import QueryStringParser from '../../../src/agent/utils/query-string';

describe('QueryStringParser', () => {
  const collectionSimple = factories.collection.build({
    name: 'books',
    schema: factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.isPrimaryKey().build(),
        name: factories.columnSchema.build(),
      },
      segments: ['fake-segment'],
    }),
  });

  describe('parseConditionTree', () => {
    test('should return null when not provided', () => {
      const context = createMockContext({});

      expect(QueryStringParser.parseConditionTree(collectionSimple, context)).toBeNull();
    });

    test('should work when passed in the querystring (for list)', () => {
      const context = createMockContext({
        customProperties: {
          query: {
            filters: JSON.stringify({
              aggregator: 'and',
              conditions: [
                { field: 'id', operator: 'equal', value: '123e4567-e89b-12d3-a456-426614174000' },
              ],
            }),
          },
        },
      });

      const conditionTree = QueryStringParser.parseConditionTree(collectionSimple, context);

      expect(conditionTree).toEqual({
        field: 'id',
        operator: 'equal',
        value: '123e4567-e89b-12d3-a456-426614174000',
      });
    });

    test('should work when passed in the body (for charts)', () => {
      const context = createMockContext({
        requestBody: {
          filters: JSON.stringify({
            field: 'id',
            operator: 'equal',
            value: '123e4567-e89b-12d3-a456-426614174000',
          }),
        },
      });

      const conditionTree = QueryStringParser.parseConditionTree(collectionSimple, context);

      expect(conditionTree).toEqual({
        field: 'id',
        operator: 'equal',
        value: '123e4567-e89b-12d3-a456-426614174000',
      });
    });

    test('should work when passed in the body (for actions)', () => {
      const context = createMockContext({
        requestBody: {
          data: {
            attributes: {
              all_records_subset_query: {
                filters: JSON.stringify({
                  field: 'id',
                  operator: 'equal',
                  value: '123e4567-e89b-12d3-a456-426614174000',
                }),
              },
            },
          },
        },
      });

      const conditionTree = QueryStringParser.parseConditionTree(collectionSimple, context);

      expect(conditionTree).toEqual({
        field: 'id',
        operator: 'equal',
        value: '123e4567-e89b-12d3-a456-426614174000',
      });
    });

    test('should crash when the collection does not supports the requested operators', () => {
      const context = createMockContext({
        requestBody: {
          filters: JSON.stringify({
            field: 'id',
            operator: 'greater_than',
            value: '123e4567-e89b-12d3-a456-426614174000',
          }),
        },
      });

      const fn = () => QueryStringParser.parseConditionTree(collectionSimple, context);

      expect(fn).toThrow(ValidationError);
    });
  });

  describe('parseProjection', () => {
    describe('on a flat collection', () => {
      describe('on a well formed request', () => {
        test('should convert the request to a valid projection', () => {
          const context = createMockContext({
            customProperties: { query: { 'fields[books]': 'id' } },
          });

          const projection = QueryStringParser.parseProjection(collectionSimple, context);

          expect(projection).toEqual(['id']);
        });

        describe('when the request does not contain the primary keys', () => {
          test('should return the requested project without the primary keys', () => {
            const context = createMockContext({
              customProperties: { query: { 'fields[books]': 'name' } },
            });

            const projection = QueryStringParser.parseProjection(collectionSimple, context);

            expect(projection).toEqual(['name']);
          });
        });
      });

      describe('on a malformed request', () => {
        describe('when the requested projection is contains fields that do not exist', () => {
          test('should return an ValidationError response with an error message', () => {
            const context = createMockContext({
              customProperties: { query: { 'fields[books]': 'field-that-do-not-exist' } },
            });

            const fn = () => QueryStringParser.parseProjection(collectionSimple, context);

            expect(fn).toThrow('Invalid projection');
          });
        });

        describe('when the request does not contains fields at all', () => {
          test('should return an ValidationError response with an error message', () => {
            const context = createMockContext({
              customProperties: { query: {} },
            });

            const fn = () => QueryStringParser.parseProjection(collectionSimple, context);

            expect(fn).toThrow('Invalid projection');
          });
        });
      });
    });

    describe('on a collection with relationships', () => {
      const dataSource = factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'cars',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
              name: factories.columnSchema.build(),
              owner: factories.oneToOneSchema.build({
                foreignCollection: 'owner',
                originKey: 'id',
                originKeyTarget: 'id',
              }),
            },
          }),
        }),
        factories.collection.build({
          name: 'owner',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
              name: factories.columnSchema.build(),
            },
          }),
        }),
      ]);

      test('should convert the request to a valid projection', () => {
        const context = createMockContext({
          customProperties: { query: { 'fields[cars]': 'id,owner', 'fields[owner]': 'name' } },
        });

        const projection = QueryStringParser.parseProjectionWithPks(
          dataSource.getCollection('cars'),
          context,
        );

        expect(projection).toEqual(['id', 'owner:name', 'owner:id']);
      });
    });
  });

  describe('parseProjectionWithPks', () => {
    describe('when the request does not contain the primary keys', () => {
      test('should return the requested project with the primary keys', () => {
        const context = createMockContext({
          customProperties: { query: { 'fields[books]': 'name' } },
        });

        const projection = QueryStringParser.parseProjectionWithPks(collectionSimple, context);

        expect(projection).toEqual(['name', 'id']);
      });
    });

    describe('on a collection with relationships', () => {
      const dataSource = factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'cars',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
              name: factories.columnSchema.build(),
              owner: factories.oneToOneSchema.build({
                foreignCollection: 'owner',
                originKey: 'id',
              }),
            },
          }),
        }),
        factories.collection.build({
          name: 'owner',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
              name: factories.columnSchema.build(),
            },
          }),
        }),
      ]);

      test('should convert the request to a valid projection', () => {
        const context = createMockContext({
          customProperties: { query: { 'fields[cars]': 'id,owner', 'fields[owner]': 'name' } },
        });

        const projection = QueryStringParser.parseProjectionWithPks(
          dataSource.getCollection('cars'),
          context,
        );

        expect(projection).toEqual(['id', 'owner:name', 'owner:id']);
      });
    });
  });

  describe('parseSearch', () => {
    test('should return null when not provided', () => {
      const context = createMockContext({});

      expect(QueryStringParser.parseSearch(collectionSimple, context)).toBeNull();
    });

    test('should throw an error when the collection is not searchable', () => {
      const context = createMockContext({
        customProperties: { query: { search: 'searched argument' } },
      });

      const collection = factories.collection.build({
        schema: factories.collectionSchema.build({
          searchable: false,
        }),
      });
      const fn = () => QueryStringParser.parseSearch(collection, context);

      expect(fn).toThrow('Collection is not searchable');
    });

    test('should return the query search parameter', () => {
      const context = createMockContext({
        customProperties: { query: { search: 'searched argument' } },
      });

      expect(QueryStringParser.parseSearch(collectionSimple, context)).toEqual('searched argument');
    });

    test('should convert the query search parameter as string', () => {
      const context = createMockContext({
        customProperties: { query: { search: 1234 } },
      });

      expect(QueryStringParser.parseSearch(collectionSimple, context)).toEqual('1234');
    });

    test('should work when passed in the body (actions)', () => {
      const context = createMockContext({
        requestBody: {
          data: { attributes: { all_records_subset_query: { search: 'searched argument' } } },
        },
      });

      expect(QueryStringParser.parseSearch(collectionSimple, context)).toEqual('searched argument');
    });
  });

  describe('parseSearchExtended', () => {
    test('should return the query searchExtended parameter', () => {
      const context = createMockContext({
        customProperties: { query: { searchExtended: true } },
      });

      expect(QueryStringParser.parseSearchExtended(context)).toEqual(true);
    });

    test('should return false for falsy "0" string', () => {
      const context = createMockContext({
        customProperties: { query: { searchExtended: '0' } },
      });

      expect(QueryStringParser.parseSearchExtended(context)).toEqual(false);
    });

    test('should return false for falsy "false" string', () => {
      const context = createMockContext({
        customProperties: { query: { searchExtended: 'false' } },
      });

      expect(QueryStringParser.parseSearchExtended(context)).toEqual(false);
    });
  });

  describe('parseSegment', () => {
    test('should return null when no segment is provided', () => {
      const context = createMockContext({
        customProperties: { query: {} },
      });

      expect(QueryStringParser.parseSegment(collectionSimple, context)).toEqual(null);
    });

    test('should return the segment name when it exists', () => {
      const context = createMockContext({
        customProperties: { query: { segment: 'fake-segment' } },
      });

      expect(QueryStringParser.parseSegment(collectionSimple, context)).toEqual('fake-segment');
    });

    test('should throw a ValidationError when the segment name does not exist', () => {
      const context = createMockContext({
        customProperties: { query: { segment: 'fake-segment-that-dont-exist' } },
      });

      const fn = () => QueryStringParser.parseSegment(collectionSimple, context);

      expect(fn).toThrow('Invalid segment: "fake-segment-that-dont-exist"');
    });

    test('should work when passed in the body (actions)', () => {
      const context = createMockContext({
        requestBody: {
          data: { attributes: { all_records_subset_query: { segment: 'fake-segment' } } },
        },
      });

      expect(QueryStringParser.parseSegment(collectionSimple, context)).toEqual('fake-segment');
    });
  });

  describe('parseTimezone', () => {
    test('should return the timezone', () => {
      const context = createMockContext({
        customProperties: { query: { timezone: 'America/Los_Angeles' } },
      });

      expect(QueryStringParser.parseTimezone(context)).toEqual('America/Los_Angeles');
    });

    test('should throw a ValidationError when the timezone is missing', () => {
      const context = createMockContext({
        customProperties: { query: {} },
      });

      const fn = () => QueryStringParser.parseTimezone(context);

      expect(fn).toThrow('Missing timezone');
    });

    test('should throw a ValidationError when the timezone is invalid', () => {
      const context = createMockContext({
        customProperties: { query: { timezone: 'ThisTZ/Donotexist' } },
      });

      const fn = () => QueryStringParser.parseTimezone(context);

      expect(fn).toThrow('Invalid timezone: "ThisTZ/Donotexist"');
    });

    describe('when timezone are not available in the environment', () => {
      let intlDateTimeFormatSpy: jest.SpyInstance;
      beforeEach(() => {
        intlDateTimeFormatSpy = jest.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
          format: null,
          formatToParts: null,
          resolvedOptions: (): Intl.ResolvedDateTimeFormatOptions => ({
            timeZone: null,
            locale: null,
            calendar: null,
            numberingSystem: null,
          }),
        });
      });

      afterEach(() => {
        intlDateTimeFormatSpy.mockRestore();
      });

      test('should throw a HTTP 500 when the timezone cannot be validated', () => {
        const context = createMockContext({
          customProperties: { query: { timezone: 'America/Los_Angeles' } },
        });

        const fn = () => QueryStringParser.parseTimezone(context);

        expect(fn).toThrow(new Error('Time zones are not available in this environment'));
      });
    });
  });

  describe('parsePagination', () => {
    test('should return the pagination parameters', () => {
      const context = createMockContext({
        customProperties: { query: { 'page[size]': 10, 'page[number]': 3 } },
      });

      const pagination = QueryStringParser.parsePagination(context);

      expect(pagination.limit).toEqual(10);
      expect(pagination.skip).toEqual(20);
    });

    describe('when context does not provide the pagination parameters', () => {
      test('should return the default limit 15 skip 0', () => {
        const context = createMockContext({
          customProperties: { query: {} },
        });

        const pagination = QueryStringParser.parsePagination(context);

        expect(pagination.limit).toEqual(15);
        expect(pagination.skip).toEqual(0);
      });
    });

    describe('when context provides invalid values', () => {
      test('should return a ValidationError error', () => {
        const context = createMockContext({
          customProperties: { query: { 'page[size]': -5, 'page[number]': 'NaN' } },
        });

        const fn = () => QueryStringParser.parsePagination(context);

        expect(fn).toThrow('Invalid pagination [limit: -5, skip: NaN]');
      });
    });
  });

  describe('parseSort', () => {
    test('should sort by pk ascending when not sort is given', () => {
      const context = createMockContext({
        customProperties: { query: {} },
      });

      const sort = QueryStringParser.parseSort(collectionSimple, context);

      expect(sort).toEqual([{ field: 'id', ascending: true }]);
    });

    test('should sort by the request field and order when given', () => {
      const context = createMockContext({
        customProperties: { query: { sort: '-name' } },
      });

      const sort = QueryStringParser.parseSort(collectionSimple, context);

      expect(sort).toEqual([{ field: 'name', ascending: false }]);
    });

    test('should throw a ValidationError when the requested sort is invalid', () => {
      const context = createMockContext({
        customProperties: { query: { sort: '-fieldThatDoNotExist' } },
      });

      const fn = () => QueryStringParser.parseSort(collectionSimple, context);

      expect(fn).toThrow('Invalid sort: -fieldThatDoNotExist');
    });
  });
});
