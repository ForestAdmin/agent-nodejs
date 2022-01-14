import { FieldTypes, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import QueryStringParser from '../../src/utils/query-string';
import * as factories from '../__factories__';

describe('QueryStringParser', () => {
  describe('parseProjection', () => {
    const partialCollection = {
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: {
            type: FieldTypes.Column,
            columnType: PrimitiveTypes.Uuid,
            isPrimaryKey: true,
          },
          name: { type: FieldTypes.Column, columnType: PrimitiveTypes.String },
        },
      }),
    };
    const collection = factories.collection.build(partialCollection);

    describe('on a well formed request', () => {
      test('should convert the request to a valid projection', () => {
        const context = {
          request: { query: { 'fields[books]': 'id' } },
          response: {},
        } as unknown as Context;

        const projection = QueryStringParser.parseProjection(collection, context);
        expect(projection).toEqual(['id']);
      });

      describe('when the request does not contain the primary keys', () => {
        test('should return the requested project with the primary keys', () => {
          const context = {
            request: { query: { 'fields[books]': 'name' } },
            response: {},
          } as unknown as Context;

          const projection = QueryStringParser.parseProjection(collection, context);
          expect(projection).toEqual(['name', 'id']);
        });
      });
    });

    describe('on a malformed request', () => {
      describe('when the requested projection is contains fields that do not exist', () => {
        test('should return an HTTP 400 response with an error message', () => {
          const throwSpy = jest.fn();
          const context = {
            request: { query: { 'fields[books]': 'field-that-do-not-exist' } },
            response: {},
            throw: throwSpy,
          } as unknown as Context;

          QueryStringParser.parseProjection(collection, context);
          expect(throwSpy).toHaveBeenCalledWith(400, expect.stringContaining('Invalid projection'));
        });
      });

      describe('when the request does not contains fields at all', () => {
        test('should return an HTTP 400 response with an error message', () => {
          const throwSpy = jest.fn();
          const context = {
            request: { query: {} },
            response: {},
            throw: throwSpy,
          } as unknown as Context;

          QueryStringParser.parseProjection(collection, context);
          expect(throwSpy).toHaveBeenCalledWith(400, expect.stringContaining('Invalid projection'));
        });
      });
    });
  });
});
