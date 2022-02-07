import DataSourceDecorator from '../../../src/decorators/datasource-decorator';
import PublicationCollectionDecorator from '../../../src/decorators/publication/collection';
import { Collection, DataSource } from '../../../src/interfaces/collection';
import { PrimitiveTypes } from '../../../src/interfaces/schema';
import * as factories from '../../__factories__';

describe('PublicationCollectionDecorator', () => {
  // State
  let dataSource: DataSource;
  let decoratedDataSource: DataSourceDecorator<PublicationCollectionDecorator>;

  // Convenience: Direct access to collections before and after decoration
  let persons: Collection;
  let bookPersons: Collection;
  let books: Collection;

  let newPersons: PublicationCollectionDecorator;
  let newBookPersons: PublicationCollectionDecorator;
  let newBooks: PublicationCollectionDecorator;

  // Build datasource
  beforeEach(() => {
    persons = factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          myBookPerson: factories.oneToOneSchema.build({
            foreignCollection: 'bookPersons',
            foreignKey: 'personId',
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
          date: factories.columnSchema.build({ columnType: PrimitiveTypes.Date }),
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
            originRelation: 'myPerson',
            targetRelation: 'myBook',
            throughCollection: 'bookPersons',
          }),
          myBookPersons: factories.oneToManySchema.build({
            foreignCollection: 'bookPersons',
            foreignKey: 'bookId',
          }),
        },
      }),
    });

    dataSource = factories.dataSource.buildWithCollections([persons, bookPersons, books]);
  });

  // Build decorator
  beforeEach(() => {
    decoratedDataSource = new DataSourceDecorator(dataSource, PublicationCollectionDecorator);

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
