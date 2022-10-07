import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Collection, DataSource } from '@forestadmin/datasource-toolkit';

import DataSourceDecorator from '../../../src/decorators/datasource-decorator';
import PublicationFieldCollectionDecorator from '../../../src/decorators/publication-field/collection';

describe('PublicationFieldCollectionDecorator', () => {
  // State
  let dataSource: DataSource;
  let decoratedDataSource: DataSourceDecorator<PublicationFieldCollectionDecorator>;

  // Convenience: Direct access to collections before and after decoration
  let persons: Collection;
  let bookPersons: Collection;
  let books: Collection;

  let newPersons: PublicationFieldCollectionDecorator;
  let newBookPersons: PublicationFieldCollectionDecorator;
  let newBooks: PublicationFieldCollectionDecorator;

  // Build datasource
  beforeEach(() => {
    persons = factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          myBookPerson: factories.oneToOneSchema.build({
            foreignCollection: 'bookPersons',
            originKey: 'personId',
          }),
        },
      }),
    });

    bookPersons = factories.collection.build({
      name: 'bookPersons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          bookId: factories.columnSchema.build(),
          personId: factories.columnSchema.build(),
          myBook: factories.manyToOneSchema.build({
            foreignCollection: 'books',
            foreignKey: 'bookId',
          }),
          myPerson: factories.manyToOneSchema.build({
            foreignCollection: 'persons',
            foreignKey: 'personId',
          }),
          date: factories.columnSchema.build({ columnType: 'Date' }),
        },
      }),
    });

    books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          myPersons: factories.manyToManySchema.build({
            foreignCollection: 'persons',
            foreignKey: 'personId',
            originKey: 'bookId',
            throughCollection: 'bookPersons',
          }),
          myBookPersons: factories.oneToManySchema.build({
            foreignCollection: 'bookPersons',
            originKey: 'bookId',
          }),
        },
      }),
    });

    dataSource = factories.dataSource.buildWithCollections([persons, bookPersons, books]);
  });

  // Build decorator
  beforeEach(() => {
    decoratedDataSource = new DataSourceDecorator(dataSource, PublicationFieldCollectionDecorator);

    newBooks = decoratedDataSource.getCollection('books');
    newBookPersons = decoratedDataSource.getCollection('bookPersons');
    newPersons = decoratedDataSource.getCollection('persons');
  });

  test('should throw when hiding a field which does not exists', () => {
    expect(() => newPersons.changeFieldVisibility('unknown', false)).toThrow(
      `No such field 'unknown'`,
    );
  });

  test('should throw when hiding the primary key', () => {
    expect(() => newPersons.changeFieldVisibility('id', false)).toThrow(`Cannot hide primary key`);
  });

  test('the schema should be the same when doing nothing', () => {
    expect(newPersons.schema).toStrictEqual(persons.schema);
    expect(newBookPersons.schema).toStrictEqual(bookPersons.schema);
    expect(newBooks.schema).toStrictEqual(books.schema);
  });

  test('the schema should be the same when hiding and showing fields again', () => {
    newPersons.changeFieldVisibility('myBookPerson', false);
    newPersons.changeFieldVisibility('myBookPerson', true);

    expect(newPersons.schema).toStrictEqual(persons.schema);
  });

  describe('When hiding normal fields', () => {
    beforeEach(() => {
      newBookPersons.changeFieldVisibility('date', false);
    });

    test('the field should be removed from the schema of the collection', () => {
      expect(newBookPersons.schema.fields).not.toHaveProperty('date');
    });

    test('other fields should not be affected', () => {
      expect(newBookPersons.schema.fields).toHaveProperty('bookId');
      expect(newBookPersons.schema.fields).toHaveProperty('personId');
      expect(newBookPersons.schema.fields).toHaveProperty('myBook');
      expect(newBookPersons.schema.fields).toHaveProperty('myPerson');
    });

    test('other collections should not be affected', () => {
      expect(newPersons.schema).toStrictEqual(persons.schema);
      expect(newBooks.schema).toStrictEqual(books.schema);
    });

    test('create should proxies return value (removing extra columns)', async () => {
      const created = { id: 1, bookId: 2, personId: 3, date: '1985-10-26' };
      (bookPersons.create as jest.Mock).mockResolvedValue([created]);

      const result = await newBookPersons.create(factories.caller.build(), [{ something: true }]);
      expect(result).toStrictEqual([{ id: 1, bookId: 2, personId: 3 }]);
    });
  });

  describe('When hiding foreign keys', () => {
    beforeEach(() => {
      newBookPersons.changeFieldVisibility('bookId', false);
    });

    test('the fk should be hidden', () => {
      expect(newBookPersons.schema.fields).not.toHaveProperty('bookId');
    });

    test('all linked relations should be removed as well', () => {
      expect(newBookPersons.schema.fields).not.toHaveProperty('myBook');

      expect(newBooks.schema.fields).not.toHaveProperty('myPersons');
      expect(newBooks.schema.fields).not.toHaveProperty('myBookPersons');
    });

    test('relations which do not depend on this fk should be left alone', () => {
      expect(newBookPersons.schema.fields).toHaveProperty('myPerson');

      expect(newPersons.schema.fields).toHaveProperty('myBookPerson');
    });
  });
});
