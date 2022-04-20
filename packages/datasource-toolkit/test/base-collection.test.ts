// eslint-disable-next-line max-classes-per-file
import * as factories from './__factories__';
import { AggregateResult } from '../src/interfaces/query/aggregation';
import { CollectionSchema, ColumnSchema, FieldSchema } from '../src/interfaces/schema';
import { DataSource } from '../src/interfaces/collection';
import { RecordData } from '../src/interfaces/record';
import BaseCollection from '../src/base-collection';

class ConcreteCollection extends BaseCollection {
  override schema: CollectionSchema;

  create(): Promise<RecordData[]> {
    throw new Error('Method not implemented.');
  }

  list(): Promise<RecordData[]> {
    throw new Error('Method not implemented.');
  }

  update(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  delete(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  aggregate(): Promise<AggregateResult[]> {
    throw new Error('Method not implemented.');
  }
}

describe('BaseCollection', () => {
  it('should instantiate properly when extended', () => {
    expect(new ConcreteCollection('collection', null)).toBeDefined();
  });

  describe('addAction', () => {
    class CollectionWithAction extends ConcreteCollection {
      constructor(name: string, dataSource: DataSource) {
        super(name, dataSource);

        this.addAction('myAction', null);
      }
    }

    class DuplicatedActionErrorCollection extends ConcreteCollection {
      constructor(name: string, dataSource: DataSource) {
        super(name, dataSource);

        this.addAction('duplicatedAction', null);
        this.addAction('duplicatedAction', null);
      }
    }

    it('should prevent instanciation when adding action with duplicated name', () => {
      expect(() => new DuplicatedActionErrorCollection('duplicatedAction', null)).toThrow(
        'Action "duplicatedAction" already defined in collection',
      );
    });

    it('should add action with unique name', () => {
      const collection = new CollectionWithAction('__valid__', null);

      expect(collection).toBeInstanceOf(CollectionWithAction);
      expect(collection.schema.actions.myAction).toBeDefined();
    });
  });

  describe('addField', () => {
    const expectedField: FieldSchema = {} as ColumnSchema;
    class CollectionWithField extends ConcreteCollection {
      constructor(name: string, dataSource: DataSource) {
        super(name, dataSource);

        this.addField('__field__', expectedField);
      }
    }

    class DuplicatedFieldErrorCollection extends ConcreteCollection {
      constructor(name: string, dataSource: DataSource) {
        super(name, dataSource);

        this.addField('__duplicated__', null);
        this.addField('__duplicated__', null);
      }
    }

    it('should prevent instanciation when adding field with duplicated name', () => {
      expect(() => new DuplicatedFieldErrorCollection('__duplicated__', null)).toThrow(
        'Field "__duplicated__" already defined in collection',
      );
    });

    it('should add field with unique name', () => {
      const collection = new CollectionWithField('__valid__', null);

      expect(collection).toBeInstanceOf(CollectionWithField);
      expect(collection.schema.fields).toMatchObject({
        __field__: expectedField,
      });
    });
  });

  describe('addFields', () => {
    const firstExpectedField: FieldSchema = {} as ColumnSchema;
    const secondExpectedField: FieldSchema = {} as ColumnSchema;

    class CollectionWithFields extends ConcreteCollection {
      constructor(name: string, dataSource: DataSource) {
        super(name, dataSource);

        this.addFields({
          __first__: firstExpectedField,
          __second__: secondExpectedField,
        });
      }
    }

    it('should add all fields', () => {
      const collection = new CollectionWithFields('__valid__', null);

      expect(collection).toBeInstanceOf(CollectionWithFields);
      expect(collection.schema.fields).toMatchObject({
        __first__: firstExpectedField,
        __second__: secondExpectedField,
      });
    });
  });

  describe('addSegments', () => {
    const expectedSegments = ['__first__', '__second__'];
    class CollectionWithSegments extends ConcreteCollection {
      constructor(name: string, dataSource: DataSource) {
        super(name, dataSource);

        this.addSegments(expectedSegments);
      }
    }

    it('should add all segments', () => {
      const collection = new CollectionWithSegments('__with_segments__', null);

      expect(collection.schema.segments).toEqual(expectedSegments);
    });
  });

  describe('enableSearch', () => {
    class CollectionSearchable extends ConcreteCollection {
      constructor(name: string, dataSource: DataSource) {
        super(name, dataSource);

        this.enableSearch();
      }
    }

    it('should set searchable to true', () => {
      const collection = new CollectionSearchable('__searchable__', null);

      expect(collection.schema.searchable).toBe(true);
    });
  });

  describe('execute', () => {
    test('it always throws', async () => {
      const collection = new ConcreteCollection('books', null);

      await expect(collection.execute(factories.recipient.build(), 'someAction')).rejects.toThrow();
    });
  });

  describe('getForm', () => {
    test('it return an empty form', async () => {
      const collection = new ConcreteCollection('books', null);

      await expect(collection.getForm()).resolves.toStrictEqual([]);
    });
  });
});
