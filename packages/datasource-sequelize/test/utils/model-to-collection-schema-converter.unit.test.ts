import { CollectionSchema } from '@forestadmin/datasource-toolkit';
// eslint-disable-next-line max-len
import ModelToCollectionSchemaConverter from '../../src/utils/model-to-collection-schema-converter';

describe('Utils > ModelToCollectionSchemaConverter', () => {
  describe('convert', () => {
    const emptyCollectionSchema: CollectionSchema = {
      actions: {},
      fields: {},
      searchable: false,
      segments: [],
    };

    // FIXME: Temporary test.
    it('should return a default collection schema', () => {
      expect(ModelToCollectionSchemaConverter.convert({})).toEqual(emptyCollectionSchema);
    });
  });
});
