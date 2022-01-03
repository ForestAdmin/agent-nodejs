import {
  CollectionSchema,
  FieldTypes,
  Operator,
  PrimitiveTypes,
} from '@forestadmin/datasource-toolkit';
import IdUtils from '../../src/utils/id';

const noPkSchema: CollectionSchema = {
  actions: [],
  searchable: true,
  segments: [],
  fields: {},
};

const numberSchema: CollectionSchema = {
  actions: [],
  searchable: true,
  segments: [],
  fields: {
    id: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.Number,
      isPrimaryKey: true,
      filterOperators: new Set<Operator>([]),
    },
  },
};

const stringSchema: CollectionSchema = {
  actions: [],
  searchable: true,
  segments: [],
  fields: {
    id: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.String,
      isPrimaryKey: true,
      filterOperators: new Set<Operator>([]),
    },
  },
};

const compositeSchema: CollectionSchema = {
  actions: [],
  searchable: true,
  segments: [],
  fields: {
    id: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.Number,
      isPrimaryKey: true,
      filterOperators: new Set<Operator>([]),
    },
    otherId: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.String,
      isPrimaryKey: true,
      filterOperators: new Set<Operator>([]),
    },
  },
};

describe('IdUtils', () => {
  describe('pack', () => {
    test('should pack a simple number id', () => {
      expect(IdUtils.packId(numberSchema, { id: 34 })).toStrictEqual('34');
    });

    test('should pack a simple string id', () => {
      expect(IdUtils.packId(stringSchema, { id: 'toto' })).toStrictEqual('toto');
    });

    test('should pack a composite (number, string) id', () => {
      const packed = IdUtils.packId(compositeSchema, { id: 23, otherId: 'something' });
      expect(packed).toStrictEqual('23|something');
    });

    test('should fail if no pk is defined', () => {
      const fn = () => IdUtils.packId(noPkSchema, {});
      expect(fn).toThrow(/no primary key/);
    });

    test('should fail if pks are missing the record', () => {
      const fn = () => IdUtils.packId(numberSchema, { otherId: 23 });
      expect(fn).toThrow(/expected field 'id'/);
    });
  });

  describe('unpack', () => {
    test('should work on a number id', () => {
      expect(IdUtils.unpackId(numberSchema, '34')).toStrictEqual([34]);
    });

    test('should work on a string id', () => {
      expect(IdUtils.unpackId(stringSchema, '34')).toStrictEqual(['34']);
    });

    test('should work on a composite id', () => {
      expect(IdUtils.unpackId(compositeSchema, '34|34')).toStrictEqual([34, '34']);
    });

    test('should fail if not pk is defined', () => {
      const fn = () => IdUtils.unpackId(noPkSchema, '34|34');
      expect(fn).toThrow(/Expected 0 values/);
    });

    test('should fail if the number of parts does not match the schema', () => {
      const fn = () => IdUtils.unpackId(stringSchema, '34|34');
      expect(fn).toThrow(/Expected 1 values/);
    });

    test('should fail if a number id cannot be properly casted', () => {
      const fn = () => IdUtils.unpackId(numberSchema, 'something');
      expect(fn).toThrow(/Failed to parse number/);
    });
  });
});
