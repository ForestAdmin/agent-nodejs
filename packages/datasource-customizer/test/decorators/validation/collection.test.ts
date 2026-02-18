import type { Collection, DataSource } from '@forestadmin/datasource-toolkit';

import {
  Aggregation,
  DataSourceDecorator,
  MissingFieldError,
  RelationFieldAccessDeniedError,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

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
          id: factories.columnSchema.uuidPrimaryKey().build({ isReadOnly: true }),
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
      MissingFieldError,
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
      RelationFieldAccessDeniedError,
    );
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

  describe('Aggregate validation', () => {
    function buildWithCapabilities(aggregationCapabilities, fields?) {
      const col = factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: fields ?? {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            title: factories.columnSchema.build({ isGroupable: true }),
          },
          aggregationCapabilities,
        }),
      });
      const ds = factories.dataSource.buildWithCollection(col);
      const decorated = new DataSourceDecorator(ds, ValidationDecorator);

      return { col, decorated: decorated.getCollection('books') };
    }

    test('should pass when aggregationCapabilities allows all (supportGroups: true)', async () => {
      const { col, decorated } = buildWithCapabilities({
        supportGroups: true,
        supportedDateOperations: new Set(['Year', 'Quarter', 'Month', 'Week', 'Day']),
      });

      await decorated.aggregate(
        factories.caller.build(),
        factories.filter.build(),
        new Aggregation({ operation: 'Count', groups: [{ field: 'title' }] }),
      );

      expect(col.aggregate).toHaveBeenCalled();
    });

    test('should pass when aggregation has no groups even if groups are not supported', async () => {
      const { col, decorated } = buildWithCapabilities({
        supportGroups: false,
        supportedDateOperations: new Set(),
      });

      await decorated.aggregate(
        factories.caller.build(),
        factories.filter.build(),
        new Aggregation({ operation: 'Count' }),
      );

      expect(col.aggregate).toHaveBeenCalled();
    });

    test('should throw when supportGroups is false and aggregation has groups', async () => {
      const { col, decorated } = buildWithCapabilities({
        supportGroups: false,
        supportedDateOperations: new Set(),
      });

      const fn = () =>
        decorated.aggregate(
          factories.caller.build(),
          factories.filter.build(),
          new Aggregation({ operation: 'Count', groups: [{ field: 'title' }] }),
        );

      await expect(fn).rejects.toThrow(ValidationError);
      await expect(fn).rejects.toThrow('does not support aggregate with groups');
      expect(col.aggregate).not.toHaveBeenCalled();
    });

    test('should throw when field is not groupable', async () => {
      const { col, decorated } = buildWithCapabilities(
        { supportGroups: true, supportedDateOperations: new Set() },
        {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          title: factories.columnSchema.build({ isGroupable: false }),
        },
      );

      const fn = () =>
        decorated.aggregate(
          factories.caller.build(),
          factories.filter.build(),
          new Aggregation({ operation: 'Count', groups: [{ field: 'title' }] }),
        );

      await expect(fn).rejects.toThrow(ValidationError);
      await expect(fn).rejects.toThrow("'title' is not groupable");
      expect(col.aggregate).not.toHaveBeenCalled();
    });

    test('should pass when field is groupable', async () => {
      const { col, decorated } = buildWithCapabilities(
        { supportGroups: true, supportedDateOperations: new Set() },
        {
          id: factories.columnSchema.uuidPrimaryKey().build(),
          title: factories.columnSchema.build({ isGroupable: true }),
        },
      );

      await decorated.aggregate(
        factories.caller.build(),
        factories.filter.build(),
        new Aggregation({ operation: 'Count', groups: [{ field: 'title' }] }),
      );

      expect(col.aggregate).toHaveBeenCalled();
    });

    test('should throw when date operation is not supported', async () => {
      const { col, decorated } = buildWithCapabilities({
        supportGroups: true,
        supportedDateOperations: new Set(),
      });

      const fn = () =>
        decorated.aggregate(
          factories.caller.build(),
          factories.filter.build(),
          new Aggregation({
            operation: 'Count',
            groups: [{ field: 'title', operation: 'Month' }],
          }),
        );

      await expect(fn).rejects.toThrow(ValidationError);
      await expect(fn).rejects.toThrow("does not support the 'Month' date operation");
      await expect(fn).rejects.toThrow('Supported date operations: [none]');
      expect(col.aggregate).not.toHaveBeenCalled();
    });

    test('should pass when date operation is supported', async () => {
      const { col, decorated } = buildWithCapabilities({
        supportGroups: true,
        supportedDateOperations: new Set(['Year', 'Month']),
      });

      await decorated.aggregate(
        factories.caller.build(),
        factories.filter.build(),
        new Aggregation({
          operation: 'Count',
          groups: [{ field: 'title', operation: 'Year' }],
        }),
      );

      expect(col.aggregate).toHaveBeenCalled();
    });

    test('should pass when group has no date operation even if none are supported', async () => {
      const { col, decorated } = buildWithCapabilities({
        supportGroups: true,
        supportedDateOperations: new Set(),
      });

      await decorated.aggregate(
        factories.caller.build(),
        factories.filter.build(),
        new Aggregation({ operation: 'Count', groups: [{ field: 'title' }] }),
      );

      expect(col.aggregate).toHaveBeenCalled();
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
