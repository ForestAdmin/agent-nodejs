import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import { getLeafCollectionName } from '../../../src/decorators/search/field-paths';

describe('getLeafCollectionName', () => {
  const buildDataSource = () =>
    factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'cards',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            panLast4: factories.columnSchema.build({ columnType: 'String' }),
            holderId: factories.columnSchema.build({ columnType: 'Uuid' }),
            holder: factories.manyToOneSchema.build({
              foreignCollection: 'holders',
              foreignKey: 'holderId',
            }),
          },
        }),
      }),
      factories.collection.build({
        name: 'holders',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            nationalId: factories.columnSchema.text().build(),
          },
        }),
      }),
    ]);

  it('should return the collection owning the last column of the path', () => {
    const cards = buildDataSource().getCollection('cards');

    expect(getLeafCollectionName(cards, 'holder:nationalId')).toBe('holders');
  });

  it('should return the collection itself for one of its own columns', () => {
    const cards = buildDataSource().getCollection('cards');

    expect(getLeafCollectionName(cards, 'panLast4')).toBe('cards');
  });

  // The caller pins the collection it asked about to readable, so answering `cards` here would
  // turn "this path does not resolve" into "this path is allowed".
  it('should throw rather than fall back to the collection it was asked about', () => {
    const cards = buildDataSource().getCollection('cards');

    expect(() => getLeafCollectionName(cards, 'panLast4:nationalId')).toThrow(
      /relation.*panLast4|panLast4.*not/i,
    );
  });

  it('should throw when the prefix names nothing at all', () => {
    const cards = buildDataSource().getCollection('cards');

    expect(() => getLeafCollectionName(cards, 'unknown:nationalId')).toThrow();
  });
});
