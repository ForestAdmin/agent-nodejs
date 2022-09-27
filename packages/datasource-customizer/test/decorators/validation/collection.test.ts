import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Collection, ColumnSchema, DataSource } from '@forestadmin/datasource-toolkit';
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
          id: factories.columnSchema.isPrimaryKey().build({ isReadOnly: true }),
          title: factories.columnSchema.build({
            filterOperators: new Set(['LongerThan', 'Present']),
          }),
          subtitle: factories.columnSchema.build({
            filterOperators: new Set(['LongerThan']),
          }),
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

  test('addValidation() should throw if the field is readonly', () => {
    expect(() => newBooks.addValidation('id', { operator: 'Present' })).toThrow(
      'Cannot add validators on a readonly field',
    );
  });

  test('addValidation() should throw if the field is a relation', () => {
    expect(() => newBooks.addValidation('author', { operator: 'Present' })).toThrow(
      "Unexpected field type: 'books.author' (found 'ManyToOne' expected 'Column')",
    );
  });

  test('addValidation() should throw if the field is in a relation', () => {
    expect(() => newBooks.addValidation('author:firstName', { operator: 'Present' })).toThrow(
      'Cannot add validators on a relation, use the foreign key instead',
    );
  });

  describe('Rule Deduplication', () => {
    test('should merge multiple GreaterThan rules', () => {
      newBooks.addValidation('title', { operator: 'GreaterThan', value: 3 });
      newBooks.addValidation('title', { operator: 'GreaterThan', value: 5 });
      newBooks.addValidation('title', { operator: 'GreaterThan', value: 2 });

      expect((newBooks.schema.fields.title as ColumnSchema).validation).toStrictEqual([
        { operator: 'GreaterThan', value: 5 },
      ]);
    });

    test('should merge multiple LessThan rules', () => {
      newBooks.addValidation('title', { operator: 'LessThan', value: 3 });
      newBooks.addValidation('title', { operator: 'LessThan', value: 5 });
      newBooks.addValidation('title', { operator: 'LessThan', value: 2 });

      expect((newBooks.schema.fields.title as ColumnSchema).validation).toStrictEqual([
        { operator: 'LessThan', value: 2 },
      ]);
    });

    test('should not merge rules using different operators', () => {
      newBooks.addValidation('title', { operator: 'GreaterThan', value: 3 });
      newBooks.addValidation('title', { operator: 'LongerThan', value: 5 });

      expect((newBooks.schema.fields.title as ColumnSchema).validation).toStrictEqual([
        { operator: 'GreaterThan', value: 3 },
        { operator: 'LongerThan', value: 5 },
      ]);
    });

    test('should not merge rules on different fields', () => {
      newBooks.addValidation('subtitle', { operator: 'GreaterThan', value: 5 });
      newBooks.addValidation('title', { operator: 'GreaterThan', value: 3 });

      expect((newBooks.schema.fields.subtitle as ColumnSchema).validation).toStrictEqual([
        { operator: 'GreaterThan', value: 5 },
      ]);

      expect((newBooks.schema.fields.title as ColumnSchema).validation).toStrictEqual([
        { operator: 'GreaterThan', value: 3 },
      ]);
    });
  });

  describe('Field selection when validating', () => {
    beforeEach(() => {
      newBooks.addValidation('subtitle', { operator: 'LongerThan', value: 5 });
      newBooks.addValidation('title', { operator: 'LongerThan', value: 5 });
    });

    test('should validate all fields when creating a record', async () => {
      const fn = () => newBooks.create(factories.caller.build(), [{ title: 'longtitle' }]);

      await expect(fn).rejects.toThrow(`'subtitle' failed validation rule: 'LongerThan(5)'`);
      expect(books.create).not.toHaveBeenCalled();
    });

    test('should validate only changed fields when updating', async () => {
      await newBooks.update(factories.caller.build(), factories.filter.build(), {
        title: 'longtitle',
      });

      expect(books.update).toHaveBeenCalled();
    });
  });

  describe('Validation when setting to null (null allowed)', () => {
    beforeEach(() => {
      newBooks.addValidation('title', { operator: 'LongerThan', value: 5 });
    });

    test('should forward create that respect the rule', async () => {
      await newBooks.create(factories.caller.build(), [{ title: null }]);
      expect(books.create).toHaveBeenCalled();
    });

    test('should forward updates that respect the rule', async () => {
      await newBooks.update(factories.caller.build(), factories.filter.build(), {
        title: null,
      });

      expect(books.update).toHaveBeenCalled();
    });
  });

  describe('Validation when setting to null (null forbidden)', () => {
    beforeEach(() => {
      newBooks.addValidation('title', { operator: 'LongerThan', value: 5 });
      newBooks.addValidation('title', { operator: 'Present' });
    });

    test('should not forward create that respect the rule', async () => {
      const fn = () => newBooks.create(factories.caller.build(), [{ title: null }]);

      await expect(fn).rejects.toThrow(`'title' failed validation rule: 'Present'`);
      expect(books.create).not.toHaveBeenCalled();
    });

    test('should not forward updates that respect the rule', async () => {
      const fn = () =>
        newBooks.update(factories.caller.build(), factories.filter.build(), {
          title: null,
        });

      await expect(fn).rejects.toThrow(`'title' failed validation rule: 'Present'`);
      expect(books.update).not.toHaveBeenCalled();
    });
  });

  describe('Validation on a defined value', () => {
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
