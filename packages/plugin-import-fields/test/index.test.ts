import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';

import { ColumnSchema, DataSource } from '@forestadmin/datasource-toolkit';
import { importFields } from '../src';

describe('plugin importFields', () => {
  const logger = () => {};

  const setupWithOneToOneRelation = (): DataSource => {
    return factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'book',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            owner: factories.oneToOneSchema.build({
              foreignCollection: 'owner',
              originKey: 'bookId',
              originKeyTarget: 'id',
            }),
          },
        }),
      }),
      factories.collection.build({
        name: 'owner',
        schema: factories.collectionSchema.build({
          fields: {
            bookId: factories.columnSchema.build({
              columnType: 'Number',
            }),
            name: factories.columnSchema.build(),
          },
        }),
      }),
    ]);
  };

  const setupWithManyToManyRelation = () => {
    return factories.dataSource.buildWithCollection(
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            authors: factories.manyToManySchema.build(),
          },
        }),
      }),
    );
  };

  const setupWithOneManyRelation = () => {
    return factories.dataSource.buildWithCollection(
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            authors: factories.oneToManySchema.build(),
          },
        }),
      }),
    );
  };

  it('imports all fields from a relation', async () => {
    const customizer = new DataSourceCustomizer();
    customizer.addDataSource(async () => setupWithOneToOneRelation());
    const dataSource = await customizer
      .customizeCollection('book', book => book.use(importFields, { relationName: 'owner' }))
      .getDataSource(logger);

    expect(Object.keys(dataSource.getCollection('book').schema.fields)).toEqual([
      'id',
      'owner',
      'owner_bookId',
      'owner_name',
    ]);
  });

  describe('when the readonly option is passed', () => {
    it('imports all fields with readonly as true', async () => {
      const customizer = new DataSourceCustomizer();
      customizer.addDataSource(async () => setupWithOneToOneRelation());
      const dataSource = await customizer
        .customizeCollection('book', book =>
          book.use(importFields, { relationName: 'owner', readonly: true }),
        )
        .getDataSource(logger);

      const { fields } = dataSource.getCollection('book').schema;
      expect((fields.owner_bookId as ColumnSchema).isReadOnly).toEqual(true);
      expect((fields.owner_name as ColumnSchema).isReadOnly).toEqual(true);
    });
  });

  describe('when the plugin is called from the datasource', () => {
    it('should throw an error', async () => {
      const customizer = new DataSourceCustomizer();
      await expect(
        customizer.use(importFields, { relationName: 'aRelation' }).getDataSource(logger),
      ).rejects.toThrow(
        'This plugin should be called when you are' +
          ' customizing a collection not directly on the agent',
      );
    });
  });

  describe('when the relation name is not given', () => {
    it('should throw an error when option is null', async () => {
      const customizer = new DataSourceCustomizer();
      customizer.addDataSource(async () => setupWithOneToOneRelation());
      await expect(
        customizer
          .customizeCollection('book', book => book.use(importFields))
          .getDataSource(logger),
      ).rejects.toThrow('Relation name is required');
    });

    it('should throw an error when relation name is not given', async () => {
      const customizer = new DataSourceCustomizer();
      customizer.addDataSource(async () => setupWithOneToOneRelation());
      await expect(
        customizer
          .customizeCollection('book', book =>
            book.use(importFields, {} as { relationName: string }),
          )
          .getDataSource(logger),
      ).rejects.toThrow('Relation name is required');
    });
  });

  describe('when the relation does not exist', () => {
    it('should throw an error', async () => {
      const customizer = new DataSourceCustomizer();
      customizer.addDataSource(async () => setupWithOneToOneRelation());
      await expect(
        customizer
          .customizeCollection('book', book => book.use(importFields, { relationName: 'notExist' }))
          .getDataSource(logger),
      ).rejects.toThrow('Relation notExist not found in collection book');
    });
  });

  describe('when the relation is a many to many', () => {
    it('should throw an error', async () => {
      const customizer = new DataSourceCustomizer();
      customizer.addDataSource(async () => setupWithManyToManyRelation());
      await expect(
        customizer
          .customizeCollection('books', book => book.use(importFields, { relationName: 'authors' }))
          .getDataSource(logger),
      ).rejects.toThrow(
        'Relation authors is a ManyToMany relation. This plugin does not support it.',
      );
    });
  });

  describe('when the relation is a one to many', () => {
    it('should throw an error', async () => {
      const customizer = new DataSourceCustomizer();
      customizer.addDataSource(async () => setupWithOneManyRelation());
      await expect(
        customizer
          .customizeCollection('books', book => book.use(importFields, { relationName: 'authors' }))
          .getDataSource(logger),
      ).rejects.toThrow(
        'Relation authors is a ManyToOne relation. This plugin does not support it.',
      );
    });
  });

  describe('when there are excluded fields', () => {
    it('should import all fields except the excluded fields', async () => {
      const customizer = new DataSourceCustomizer();
      customizer.addDataSource(async () => setupWithOneToOneRelation());
      const dataSource = await customizer
        .customizeCollection('book', book =>
          book.use(importFields, { relationName: 'owner', exclude: ['bookId'] }),
        )
        .getDataSource(logger);

      expect(Object.keys(dataSource.getCollection('book').schema.fields)).toEqual([
        'id',
        'owner',
        'owner_name',
      ]);
    });
  });

  describe('when there are included fields', () => {
    it('should import only the included fields', async () => {
      const customizer = new DataSourceCustomizer();
      customizer.addDataSource(async () => setupWithOneToOneRelation());
      const dataSource = await customizer
        .customizeCollection('book', book =>
          book.use(importFields, { relationName: 'owner', include: ['bookId'] }),
        )
        .getDataSource(logger);

      expect(Object.keys(dataSource.getCollection('book').schema.fields)).toEqual([
        'id',
        'owner',
        'owner_bookId',
      ]);
    });

    describe('when there are exclude and include', () => {
      it('should apply the both', async () => {
        const customizer = new DataSourceCustomizer();
        customizer.addDataSource(async () => setupWithOneToOneRelation());
        const dataSource = await customizer
          .customizeCollection('book', book =>
            book.use(importFields, {
              relationName: 'owner',
              include: ['bookId'],
              exclude: ['bookId'],
            }),
          )
          .getDataSource(logger);

        expect(Object.keys(dataSource.getCollection('book').schema.fields)).toEqual([
          'id',
          'owner',
        ]);
      });
    });

    describe('when a given fields does not exist', () => {
      it('should throw an error', async () => {
        const customizer = new DataSourceCustomizer();
        customizer.addDataSource(async () => setupWithOneToOneRelation());

        await expect(
          customizer
            .customizeCollection('book', book =>
              book.use(importFields, {
                relationName: 'owner',
                include: ['doesNotExist'],
              }),
            )
            .getDataSource(logger),
        ).rejects.toThrow('Field doesNotExist not found in collection owner');
      });
    });
  });
});
