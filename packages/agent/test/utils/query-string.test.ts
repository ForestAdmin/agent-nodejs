import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';
import QueryStringParser from '../../src/utils/query-string';
import * as factories from '../__factories__';

describe('QueryStringParser', () => {
  describe('parseProjection', () => {
    describe('on a flat collection', () => {
      const partialCollection = {
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.build({
              columnType: PrimitiveTypes.Uuid,
              isPrimaryKey: true,
            }),
            name: factories.columnSchema.build(),
          },
        }),
      };
      const collectionSimple = factories.collection.build(partialCollection);

      describe('on a well formed request', () => {
        test('should convert the request to a valid projection', () => {
          const context = createMockContext({
            customProperties: { query: { 'fields[books]': 'id' } },
          });

          const projection = QueryStringParser.parseProjection(collectionSimple, context);
          expect(projection).toEqual(['id']);
        });

        describe('when the request does not contain the primary keys', () => {
          test('should return the requested project with the primary keys', () => {
            const context = createMockContext({
              customProperties: { query: { 'fields[books]': 'name' } },
            });

            const projection = QueryStringParser.parseProjection(collectionSimple, context);
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
              400,
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
              400,
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
              id: factories.columnSchema.build({
                columnType: PrimitiveTypes.Uuid,
                isPrimaryKey: true,
              }),
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
              id: factories.columnSchema.build({
                columnType: PrimitiveTypes.Uuid,
                isPrimaryKey: true,
              }),
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
        expect(projection).toEqual(['id', 'owner:name', 'owner:id']);
      });
    });
  });
});
