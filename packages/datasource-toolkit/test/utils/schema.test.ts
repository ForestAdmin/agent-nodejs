import { CollectionSchema, FieldTypes } from '../../src/interfaces/schema';
import SchemaUtils from '../../src/utils/schema';

describe('SchemaUtils', () => {
  describe('getPrimaryKeys', () => {
    test('it should return fields which are primary keys', () => {
      const result = SchemaUtils.getPrimaryKeys({
        fields: {
          id: { type: FieldTypes.Column, isPrimaryKey: true },
          notId: { type: FieldTypes.Column, isPrimaryKey: false },
          otherId: { type: FieldTypes.Column, isPrimaryKey: true },
        },
      } as unknown as CollectionSchema);

      expect(result).toStrictEqual(['id', 'otherId']);
    });
  });
});
