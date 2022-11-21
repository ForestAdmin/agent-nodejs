// eslint-disable-next-line max-classes-per-file
import BaseCollection from '../src/base-collection';
import { AggregateResult } from '../src/interfaces/query/aggregation';
import { RecordData } from '../src/interfaces/record';
import { CollectionSchema, ColumnSchema, FieldSchema } from '../src/interfaces/schema';
import * as factories from './__factories__';

class ConcreteCollection extends BaseCollection {
  override schema: CollectionSchema;

  constructor() {
    super('books', factories.dataSource.build());
  }

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
    expect(new ConcreteCollection()).toBeDefined();
  });

  describe('addAction', () => {
    class CollectionWithAction extends ConcreteCollection {
      constructor() {
        super();

        this.addAction('myAction', { scope: 'Single' });
      }
    }

    class DuplicatedActionErrorCollection extends ConcreteCollection {
      constructor() {
        super();

        this.addAction('duplicatedAction', { scope: 'Single' });
        this.addAction('duplicatedAction', { scope: 'Single' });
      }
    }

    it('should prevent instanciation when adding action with duplicated name', () => {
      expect(() => new DuplicatedActionErrorCollection()).toThrow(
        'Action "duplicatedAction" already defined in collection',
      );
    });

    it('should add action with unique name', () => {
      const collection = new CollectionWithAction();

      expect(collection).toBeInstanceOf(CollectionWithAction);
      expect(collection.schema.actions.myAction).toBeDefined();
    });
  });

  describe('addChart', () => {
    class CollectionWithChart extends ConcreteCollection {
      constructor() {
        super();

        this.addChart('myChart');
      }
    }

    class DuplicatedChartErrorCollection extends ConcreteCollection {
      constructor() {
        super();

        this.addChart('duplicatedChart');
        this.addChart('duplicatedChart');
      }
    }

    it('should prevent instanciation when adding a chart with duplicated name', () => {
      expect(() => new DuplicatedChartErrorCollection()).toThrow(
        'Chart "duplicatedChart" already defined in collection',
      );
    });

    it('should add chart with unique name', () => {
      const collection = new CollectionWithChart();

      expect(collection).toBeInstanceOf(CollectionWithChart);
      expect(collection.schema.charts).toContain('myChart');
    });
  });

  describe('addField', () => {
    const expectedField: FieldSchema = {} as ColumnSchema;
    class CollectionWithField extends ConcreteCollection {
      constructor() {
        super();

        this.addField('__field__', expectedField);
      }
    }

    class DuplicatedFieldErrorCollection extends ConcreteCollection {
      constructor() {
        super();

        this.addField('__duplicated__', factories.columnSchema.build());
        this.addField('__duplicated__', factories.columnSchema.build());
      }
    }

    it('should prevent instanciation when adding field with duplicated name', () => {
      expect(() => new DuplicatedFieldErrorCollection()).toThrow(
        'Field "__duplicated__" already defined in collection',
      );
    });

    it('should add field with unique name', () => {
      const collection = new CollectionWithField();

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
      constructor() {
        super();

        this.addFields({
          __first__: firstExpectedField,
          __second__: secondExpectedField,
        });
      }
    }

    it('should add all fields', () => {
      const collection = new CollectionWithFields();

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
      constructor() {
        super();

        this.addSegments(expectedSegments);
      }
    }

    it('should add all segments', () => {
      const collection = new CollectionWithSegments();

      expect(collection.schema.segments).toEqual(expectedSegments);
    });
  });

  describe('enableSearch', () => {
    class CollectionSearchable extends ConcreteCollection {
      constructor() {
        super();

        this.enableSearch();
      }
    }

    it('should set searchable to true', () => {
      const collection = new CollectionSearchable();

      expect(collection.schema.searchable).toBe(true);
    });
  });

  describe('enableCount', () => {
    class CollectionSearchable extends ConcreteCollection {
      constructor() {
        super();

        this.enableCount();
      }
    }

    it('should set countable to true', () => {
      const collection = new CollectionSearchable();

      expect(collection.schema.countable).toBe(true);
    });
  });

  describe('execute', () => {
    test('it always throws', async () => {
      const collection = new ConcreteCollection();

      await expect(collection.execute(factories.caller.build(), 'someAction')).rejects.toThrow();
    });
  });

  describe('renderChart', () => {
    test('it always throws', async () => {
      const collection = new ConcreteCollection();

      await expect(collection.renderChart(factories.caller.build(), 'someChart')).rejects.toThrow();
    });
  });

  describe('getForm', () => {
    test('it return an empty form', async () => {
      const collection = new ConcreteCollection();

      await expect(collection.getForm()).resolves.toStrictEqual([]);
    });
  });
});
