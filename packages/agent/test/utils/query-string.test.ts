import { createMockContext } from '@shopify/jest-koa-mocks';
import { HttpCode } from '../../src/types';
import QueryStringParser from '../../src/utils/query-string';
import * as factories from '../__factories__';

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

      expect(context.throw).not.toBeCalled();
      expect(QueryStringParser.parseConditionTree(collectionSimple, context)).toBeNull();
    });

    test('should work when passed in the querystring', () => {
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

      expect(context.throw).not.toHaveBeenCalled();
      expect(conditionTree).toEqual({
        field: 'id',
        operator: 'equal',
        value: '123e4567-e89b-12d3-a456-426614174000',
      });
    });

    test('should work when passed in the body', () => {
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

      expect(context.throw).not.toHaveBeenCalled();
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

      QueryStringParser.parseConditionTree(collectionSimple, context);

      expect(context.throw).toHaveBeenCalled();
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

          expect(context.throw).not.toBeCalled();
          expect(projection).toEqual(['id']);
        });

        describe('when the request does not contain the primary keys', () => {
          test('should return the requested project with the primary keys', () => {
            const context = createMockContext({
              customProperties: { query: { 'fields[books]': 'name' } },
            });

            const projection = QueryStringParser.parseProjection(collectionSimple, context);

            expect(context.throw).not.toBeCalled();
            expect(projection).toEqual(['name', 'id']);
          });
        });
      });

      describe('on a malformed request', () => {
        describe('when the requested projection is contains fields that do not exist', () => {
          test('should return an HTTP 400 response with an error message', () => {
            const context = createMockContext({
              customProperties: { query: { 'fields[books]': 'field-that-do-not-exist' } },
            });

            QueryStringParser.parseProjection(collectionSimple, context);

            expect(context.throw).toHaveBeenCalledWith(
              HttpCode.BadRequest,
              expect.stringContaining('Invalid projection'),
            );
          });
        });

        describe('when the request does not contains fields at all', () => {
          test('should return an HTTP 400 response with an error message', () => {
            const context = createMockContext({
              customProperties: { query: {} },
            });

            QueryStringParser.parseProjection(collectionSimple, context);

            expect(context.throw).toHaveBeenCalledWith(
              HttpCode.BadRequest,
              expect.stringContaining('Invalid projection'),
            );
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
                foreignKey: 'id',
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

        const projection = QueryStringParser.parseProjection(
          dataSource.getCollection('cars'),
          context,
        );

        expect(context.throw).not.toHaveBeenCalled();
        expect(projection).toEqual(['id', 'owner:name', 'owner:id']);
      });
    });
  });

  describe('parseSearch', () => {
    test('should return null when not provided', () => {
      const context = createMockContext({});

      expect(context.throw).not.toBeCalled();
      expect(QueryStringParser.parseSearch(context)).toBeNull();
    });

    test('should return the query search parameter', () => {
      const context = createMockContext({
        customProperties: { query: { search: 'searched argument' } },
      });

      expect(context.throw).not.toBeCalled();
      expect(QueryStringParser.parseSearch(context)).toEqual('searched argument');
    });

    test('should convert the query search parameter as string', () => {
      const context = createMockContext({
        customProperties: { query: { search: 1234 } },
      });

      expect(context.throw).not.toBeCalled();
      expect(QueryStringParser.parseSearch(context)).toEqual('1234');
    });
  });

  describe('parseSearchExtended', () => {
    test('should return the query searchExtended parameter', () => {
      const context = createMockContext({
        customProperties: { query: { searchExtended: true } },
      });

      expect(context.throw).not.toBeCalled();
      expect(QueryStringParser.parseSearchExtended(context)).toEqual(true);
    });

    test('should return false for falsy "0" string', () => {
      const context = createMockContext({
        customProperties: { query: { searchExtended: '0' } },
      });

      expect(context.throw).not.toBeCalled();
      expect(QueryStringParser.parseSearchExtended(context)).toEqual(false);
    });

    test('should return false for falsy "false" string', () => {
      const context = createMockContext({
        customProperties: { query: { searchExtended: 'false' } },
      });

      expect(context.throw).not.toBeCalled();
      expect(QueryStringParser.parseSearchExtended(context)).toEqual(false);
    });
  });

  describe('parseSegment', () => {
    test('should return null when no segment is provided', () => {
      const context = createMockContext({
        customProperties: { query: {} },
      });

      expect(context.throw).not.toBeCalled();
      expect(QueryStringParser.parseSegment(collectionSimple, context)).toEqual(null);
    });

    test('should return the segment name when it exists', () => {
      const context = createMockContext({
        customProperties: { query: { segment: 'fake-segment' } },
      });

      expect(context.throw).not.toBeCalled();
      expect(QueryStringParser.parseSegment(collectionSimple, context)).toEqual('fake-segment');
    });

    test('should throw a HTTP 400 when the segment name does not exist', () => {
      const context = createMockContext({
        customProperties: { query: { segment: 'fake-segment-that-dont-exist' } },
      });

      QueryStringParser.parseSegment(collectionSimple, context);

      expect(context.throw).toHaveBeenCalledWith(
        HttpCode.BadRequest,
        'Invalid segment: "fake-segment-that-dont-exist"',
      );
    });
  });

  describe('parseTimezone', () => {
    test('should return the timezone', () => {
      const context = createMockContext({
        customProperties: { query: { timezone: 'America/Los_Angeles' } },
      });

      expect(context.throw).not.toBeCalled();
      expect(QueryStringParser.parseTimezone(context)).toEqual('America/Los_Angeles');
    });

    test('should throw a HTTP 400 when the timezone is missing', () => {
      const context = createMockContext({
        customProperties: { query: {} },
      });

      QueryStringParser.parseTimezone(context);

      expect(context.throw).toHaveBeenCalledWith(HttpCode.BadRequest, 'Missing timezone');
    });

    test('should throw a HTTP 400 when the timezone is invalid', () => {
      const context = createMockContext({
        customProperties: { query: { timezone: 'ThisTZ/Donotexist' } },
      });

      QueryStringParser.parseTimezone(context);

      expect(context.throw).toHaveBeenCalledWith(
        HttpCode.BadRequest,
        'Invalid timezone: "ThisTZ/Donotexist"',
      );
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

        QueryStringParser.parseTimezone(context);

        expect(context.throw).toHaveBeenCalledWith(
          500,
          'Time zones are not available in this environment',
        );
      });
    });
  });

  describe('parsePagination', () => {
    test('should return the pagination parameters', () => {
      const context = createMockContext({
        customProperties: { query: { 'page[size]': 10, 'page[number]': 3 } },
      });

      const pagination = QueryStringParser.parsePagination(context);

      expect(context.throw).not.toBeCalled();
      expect(pagination.limit).toEqual(10);
      expect(pagination.skip).toEqual(20);
    });

    describe('when context does not provide the pagination parameters', () => {
      test('should return the default limit 15 skip 0', () => {
        const context = createMockContext({
          customProperties: { query: {} },
        });

        const pagination = QueryStringParser.parsePagination(context);

        expect(context.throw).not.toBeCalled();
        expect(pagination.limit).toEqual(15);
        expect(pagination.skip).toEqual(0);
      });
    });

    describe('when context provides invalid values', () => {
      test('should return a HTTP 400 error', () => {
        const context = createMockContext({
          customProperties: { query: { 'page[size]': -5, 'page[number]': 'NaN' } },
        });

        QueryStringParser.parsePagination(context);

        expect(context.throw).toHaveBeenCalledWith(
          HttpCode.BadRequest,
          'Invalid pagination: "limit: -5, skip: NaN"',
        );
      });
    });
  });

  describe('parseSort', () => {
    test('should sort by pk ascending when not sort is given', () => {
      const context = createMockContext({
        customProperties: { query: {} },
      });

      const sort = QueryStringParser.parseSort(collectionSimple, context);

      expect(context.throw).not.toBeCalled();
      expect(sort).toEqual([{ field: 'id', ascending: true }]);
    });

    test('should sort by the request field and order when given', () => {
      const context = createMockContext({
        customProperties: { query: { sort: '-name' } },
      });

      const sort = QueryStringParser.parseSort(collectionSimple, context);

      expect(context.throw).not.toBeCalled();
      expect(sort).toEqual([{ field: 'name', ascending: false }]);
    });

    test('should throw a HTTP 400 when the requested sort is invalid', () => {
      const context = createMockContext({
        customProperties: { query: { sort: '-fieldThatDoNotExist' } },
      });

      QueryStringParser.parseSort(collectionSimple, context);

      expect(context.throw).toHaveBeenCalledWith(
        HttpCode.BadRequest,
        'Invalid sort: -fieldThatDoNotExist',
      );
    });
  });
});
