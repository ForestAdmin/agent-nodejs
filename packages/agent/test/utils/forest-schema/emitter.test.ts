import fs from 'fs';
import path from 'path';

import * as factories from '../../__factories__';
import SchemaEmitter from '../../../src/utils/forest-schema/emitter';

const schemaPath = '/tmp/test-schema.json';

describe('SchemaEmitter', () => {
  const baseOptions = { prefix: '/forest', schemaPath };
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'reviews',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
        },
      }),
    }),
  ]);

  beforeEach(() => {
    // Make sure that tests don't depend on each other
    if (fs.existsSync(schemaPath)) fs.unlinkSync(schemaPath);
  });

  describe('on a local deployment', () => {
    const options = { ...baseOptions, isProduction: false };

    test('it should return a fresh schema and save it to disk', async () => {
      const schema = await SchemaEmitter.getSerializedSchema(options, dataSource);
      expect(schema.meta).toHaveProperty('schemaFileHash');
      expect(schema).toMatchObject({
        meta: { liana: 'forest-nodejs-agent' },
        data: [{ attributes: { name: 'reviews' } }],
      });
    });
  });

  describe('on a production deployment', () => {
    const options = { ...baseOptions, isProduction: true };

    describe('with no schema file', () => {
      test('it should throw', async () => {
        const result = SchemaEmitter.getSerializedSchema(options, dataSource);

        await expect(result).rejects.toThrow('Providing a schema is mandatory');
      });
    });

    describe('with an available schema file', () => {
      beforeEach(() => {
        fs.copyFileSync(
          path.resolve(__dirname, '../../__data__/forestadmin-schema.json'),
          schemaPath,
        );
      });

      test('it should return the schema from the file', async () => {
        const schema = await SchemaEmitter.getSerializedSchema(options, dataSource);

        expect(schema.meta).toHaveProperty('schemaFileHash');
        expect(schema).toMatchObject({
          meta: { liana: 'forest-nodejs-agent' },
          data: [{ attributes: { name: 'book' } }],
        });
      });
    });
  });
});
