import { CollectionSchema, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import IdUtils from '../../src/utils/id';
import * as factories from '../__factories__';

describe('IdUtils', () => {
  describe('with a schema with no pk', () => {
    const noPkSchema: CollectionSchema = factories.collectionSchema.build();

    test('pack should fail', () => {
      const fn = () => IdUtils.packId(noPkSchema, {});
      expect(fn).toThrow(/no primary key/);
    });

    test('unpack should fail', () => {
      const fn = () => IdUtils.unpackId(noPkSchema, '34|34');
      expect(fn).toThrow(/Expected 0 values/);
    });
  });

  describe('with a schema with an integer id field', () => {
    const numberSchema = factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.isPrimaryKey().build({
          columnType: PrimitiveTypes.Number,
        }),
      },
    });

    test('should pack on several simple numbers id', () => {
      expect(IdUtils.packIds(numberSchema, [{ id: 34 }, { id: 35 }])).toStrictEqual(['34', '35']);
    });

    test('should pack a simple number id', () => {
      expect(IdUtils.packId(numberSchema, { id: 34 })).toStrictEqual('34');
    });

    test('should fail to pack if pks are missing the record', () => {
      const fn = () => IdUtils.packId(numberSchema, { otherId: 23 });
      expect(fn).toThrow(/expected fields: 'id'/);
    });

    test('should unpack on a several numbers id', () => {
      expect(IdUtils.unpackIds(numberSchema, ['34', '35'])).toStrictEqual([[34], [35]]);
    });

    test('should unpack on a number id', () => {
      expect(IdUtils.unpackId(numberSchema, '34')).toStrictEqual([34]);
    });

    test('should fail if a number id cannot be properly casted', () => {
      const fn = () => IdUtils.unpackId(numberSchema, 'something');
      expect(fn).toThrow(/Failed to parse number/);
    });
  });

  describe('with a schema with a string id field', () => {
    const stringSchema = factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.isPrimaryKey().build({
          columnType: PrimitiveTypes.String,
        }),
      },
    });

    test('should pack a simple string id', () => {
      expect(IdUtils.packId(stringSchema, { id: 'toto' })).toStrictEqual('toto');
    });

    test('should unpack on a string id', () => {
      expect(IdUtils.unpackId(stringSchema, '34')).toStrictEqual(['34']);
    });

    test('should fail to unpack if the number of parts does not match the schema', () => {
      const fn = () => IdUtils.unpackId(stringSchema, '34|34');
      expect(fn).toThrow(/Expected 1 values/);
    });
  });

  describe('with a schema with a composite id field', () => {
    const compositeSchema = factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.isPrimaryKey().build({
          columnType: PrimitiveTypes.Number,
        }),
        otherId: factories.columnSchema.isPrimaryKey().build({
          columnType: PrimitiveTypes.String,
        }),
      },
    });

    test('should work on a composite id', () => {
      expect(IdUtils.unpackId(compositeSchema, '34|34')).toStrictEqual([34, '34']);
    });

    test('should pack a composite (number, string) id', () => {
      const packed = IdUtils.packId(compositeSchema, { id: 23, otherId: 'something' });
      expect(packed).toStrictEqual('23|something');
    });
  });
});
