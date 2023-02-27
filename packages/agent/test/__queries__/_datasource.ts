import * as factories from '../__factories__';

export const posts = factories.collection.build({
  name: 'post',
  schema: factories.collectionSchema.build({
    fields: {
      id: factories.columnSchema.numericPrimaryKey().build(),
    },
  }),
});

export const comments = factories.collection.build({
  name: 'comment',
  schema: factories.collectionSchema.build({
    actions: {
      Single: { scope: 'Single' },
      Bulk: { scope: 'Bulk' },
      Global: { scope: 'Global' },
    },
    charts: [],
    fields: {
      id: factories.columnSchema.numericPrimaryKey().build(),
      postId: factories.columnSchema.build({ columnType: 'Number' }),
      name: factories.columnSchema.build({ columnType: 'String' }),
      email: factories.columnSchema.build({ columnType: 'String' }),
      body: factories.columnSchema.build({ columnType: 'String' }),
      post: factories.manyToOneSchema.build({ foreignCollection: 'post', foreignKey: 'postId' }),
    },
    segments: ['pending'],
  }),
});

export const dataSource = factories.dataSource.buildWithCollections([posts, comments]);
