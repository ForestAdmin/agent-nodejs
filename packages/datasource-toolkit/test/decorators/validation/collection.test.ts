import * as factories from '../../__factories__';
import { Collection, DataSource } from '../../../src/interfaces/collection';
import DataSourceDecorator from '../../../src/decorators/datasource-decorator';
import ValidationDecorator from '../../../src/decorators/validation/collection';

describe('SortEmulationDecoratorCollection', () => {
  // State
  let dataSource: DataSource;
  let decoratedDataSource: DataSourceDecorator<ValidationDecorator>;

  // Convenience: Direct access to collections before and after decoration
  let books: Collection;
  let newBooks: ValidationDecorator;

  // Build datasource
  beforeEach(() => {
    books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          title: factories.columnSchema.build({ isSortable: false }),
          author: factories.manyToOneSchema.build({ foreignCollection: 'author' }),
        },
      }),
    });

    const reviews = factories.collection.build({
      name: 'author',
      schema: {
        fields: { firstName: factories.columnSchema.build() },
      },
    });

    dataSource = factories.dataSource.buildWithCollections([books, reviews]);
  });

  // Build decorator
  beforeEach(() => {
    decoratedDataSource = new DataSourceDecorator(dataSource, ValidationDecorator);

    newBooks = decoratedDataSource.getCollection('books');
  });

  test('addValidation() should throw if the field does not exists', () => {
    expect(() => newBooks.addValidation('__dontExist', { operator: 'Present' })).toThrow(
      "Column not found: 'books.__dontExist'",
    );
  });

  test('addValidation() should throw if the field is a relation', () => {
    expect(() => newBooks.addValidation('author', { operator: 'Present' })).toThrow(
      "Unexpected field type: 'books.author' (found 'ManyToOne' expected 'Column')",
    );
  });

  test('addValidation() should throw if the field is in a relation', () => {
    expect(() => newBooks.addValidation('author:firstName', { operator: 'Present' })).toThrow(
      'Cannot addValidation on relation, use the foreign key instead',
    );
  });

  describe('with a longerthan 5 rule', () => {
    beforeEach(() => {
      newBooks.addValidation('title', { operator: 'LongerThan', value: 5 });
    });

    test('should forward create that respect the rule', async () => {
      await newBooks.create(factories.caller.build(), [{ title: '123456' }]);
      expect(books.create).toHaveBeenCalled();
    });

    test('should forward updates that respect the rule', async () => {
      await newBooks.update(factories.caller.build(), factories.filter.build(), {
        title: '123456',
      });
      expect(books.update).toHaveBeenCalled();
    });

    test('should reject create that do not respect the rule', async () => {
      const fn = () => newBooks.create(factories.caller.build(), [{ title: '1234' }]);

      await expect(fn).rejects.toThrow(`'title' failed validation rule: 'LongerThan(5)'`);
      expect(books.create).not.toHaveBeenCalled();
    });

    test('should reject updates that do not respect the rule', async () => {
      const fn = () =>
        newBooks.update(factories.caller.build(), factories.filter.build(), {
          title: '1234',
        });

      await expect(fn).rejects.toThrow(`'title' failed validation rule: 'LongerThan(5)'`);
      expect(books.update).not.toHaveBeenCalled();
    });
  });
});
