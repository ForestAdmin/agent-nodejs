import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';
import { ColumnSchema } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import flattenRelation from '../src/flatten-relation';

describe('flattenRelation', () => {
  const logger = () => {};

  const setupWithOneToOneRelation = (): DataSourceCustomizer => {
    const customizer = new DataSourceCustomizer();

    customizer.addDataSource(async () =>
      factories.dataSource.buildWithCollections([
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
              bookId: factories.columnSchema.build({ columnType: 'Number' }),
              countryId: factories.columnSchema.build({ columnType: 'Uuid' }),
              country: factories.manyToOneSchema.build({
                foreignCollection: 'country',
                foreignKey: 'countryId',
                foreignKeyTarget: 'id',
              }),
              name: factories.columnSchema.build(),
            },
          }),
        }),
        factories.collection.build({
          name: 'country',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.uuidPrimaryKey().build(),
            },
          }),
        }),
      ]),
    );

    return customizer;
  };

  const setupWithManyToManyRelation = (): DataSourceCustomizer => {
    const customizer = new DataSourceCustomizer();

    customizer.addDataSource(async () =>
      factories.dataSource.buildWithCollection(
        factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.uuidPrimaryKey().build(),
              authors: factories.manyToManySchema.build(),
            },
          }),
        }),
      ),
    );

    return customizer;
  };

  it('imports all fields from a relation', async () => {
    const customizer = setupWithOneToOneRelation();
    const dataSource = await customizer
      .customizeCollection('book', book => book.use(flattenRelation, { relationName: 'owner' }))
      .getDataSource(logger);

    expect(Object.keys(dataSource.getCollection('book').schema.fields)).toEqual([
      'id',
      'owner',
      'owner@@@bookId',
      'owner@@@countryId',
      'owner@@@name',
    ]);
  });

  it('imports fields from a nested relation', async () => {
    const customizer = setupWithOneToOneRelation();
    const dataSource = await customizer
      .customizeCollection('book', book =>
        book.use(flattenRelation, { relationName: 'owner:country' }),
      )
      .getDataSource(logger);

    expect(Object.keys(dataSource.getCollection('book').schema.fields)).toEqual([
      'id',
      'owner',
      'owner@@@country@@@id',
    ]);
  });

  describe('when the readonly option is passed', () => {
    it('imports all fields with readonly as true', async () => {
      const customizer = setupWithOneToOneRelation();
      const dataSource = await customizer
        .customizeCollection('book', book =>
          book.use(flattenRelation, { relationName: 'owner', readonly: true }),
        )
        .getDataSource(logger);

      const { fields } = dataSource.getCollection('book').schema;
      expect((fields['owner@@@bookId'] as ColumnSchema).isReadOnly).toEqual(true);
      expect((fields['owner@@@name'] as ColumnSchema).isReadOnly).toEqual(true);
    });
  });

  describe('when the plugin is called from the datasource', () => {
    it('should throw an error', async () => {
      const customizer = new DataSourceCustomizer();
      await expect(
        customizer.use(flattenRelation, { relationName: 'aRelation' }).getDataSource(logger),
      ).rejects.toThrow('This plugin can only be called when customizing collections.');
    });
  });

  describe('when the relation name is not given', () => {
    it('should throw an error when option is null', async () => {
      const customizer = setupWithOneToOneRelation();
      await expect(
        customizer
          .customizeCollection('book', book => book.use(flattenRelation))
          .getDataSource(logger),
      ).rejects.toThrow('options.relationName is required.');
    });

    it('should throw an error when relation name is not given', async () => {
      const customizer = setupWithOneToOneRelation();
      await expect(
        customizer
          .customizeCollection('book', book =>
            book.use(flattenRelation, {} as { relationName: string }),
          )
          .getDataSource(logger),
      ).rejects.toThrow('options.relationName is required.');
    });
  });

  describe('Errors on options.relationName', () => {
    it('should throw if error.relationName is not found', async () => {
      const customizer = setupWithOneToOneRelation();
      await expect(
        customizer
          .customizeCollection('book', book =>
            book.use(flattenRelation, { relationName: 'notExist' }),
          )
          .getDataSource(logger),
      ).rejects.toThrow("'book.notExist' not found");
    });

    it('should throw if error.relationName is a column', async () => {
      const customizer = setupWithManyToManyRelation();

      await expect(
        customizer
          .customizeCollection('books', book => book.use(flattenRelation, { relationName: 'id' }))
          .getDataSource(logger),
      ).rejects.toThrow("'books.id' is a column, not a relation");
    });

    it('should throw if error.relationName is not the expected relation type', async () => {
      const customizer = setupWithManyToManyRelation();

      await expect(
        customizer
          .customizeCollection('books', book =>
            book.use(flattenRelation, { relationName: 'authors' }),
          )
          .getDataSource(logger),
      ).rejects.toThrow("'books.authors' is not a ManyToOne or OneToOne relation");
    });
  });

  describe('when there are excluded fields', () => {
    it('should import all fields except the excluded fields', async () => {
      const customizer = setupWithOneToOneRelation();
      const dataSource = await customizer
        .customizeCollection('book', book =>
          book.use(flattenRelation, { relationName: 'owner', exclude: ['bookId'] }),
        )
        .getDataSource(logger);

      expect(Object.keys(dataSource.getCollection('book').schema.fields)).toEqual([
        'id',
        'owner',
        'owner@@@countryId',
        'owner@@@name',
      ]);
    });
  });

  describe('when there are included fields', () => {
    it('should import only the included fields', async () => {
      const customizer = setupWithOneToOneRelation();
      const dataSource = await customizer
        .customizeCollection('book', book =>
          book.use(flattenRelation, { relationName: 'owner', include: ['bookId'] }),
        )
        .getDataSource(logger);

      expect(Object.keys(dataSource.getCollection('book').schema.fields)).toEqual([
        'id',
        'owner',
        'owner@@@bookId',
      ]);
    });

    describe('when there are exclude and include', () => {
      it('should apply the both', async () => {
        const customizer = setupWithOneToOneRelation();
        const dataSource = await customizer
          .customizeCollection('book', book =>
            book.use(flattenRelation, {
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
        const customizer = setupWithOneToOneRelation();

        await expect(
          customizer
            .customizeCollection('book', book =>
              book.use(flattenRelation, { relationName: 'owner', include: ['doesNotExist'] }),
            )
            .getDataSource(logger),
        ).rejects.toThrow('Field doesNotExist not found in collection owner');
      });
    });
  });
});
