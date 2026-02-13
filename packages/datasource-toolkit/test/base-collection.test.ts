// eslint-disable-next-line max-classes-per-file
import type { AggregateResult } from '../src/interfaces/query/aggregation';
import type { RecordData } from '../src/interfaces/record';
import type { ColumnSchema, FieldSchema } from '../src/interfaces/schema';

import * as factories from './__factories__';
import BaseCollection from '../src/base-collection';

class ConcreteCollection extends BaseCollection {
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
        "The 'books.__duplicated__' field is already defined. Please check if the field name is correct and unique.",
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

  describe('aggregateCapabilities', () => {
    it('should have default capabilities with all groups and date operations supported', () => {
      const collection = new ConcreteCollection();

      expect(collection.schema.aggregateCapabilities).toEqual({
        supportGroups: true,
        supportDateOperations: new Set(['Year', 'Quarter', 'Month', 'Week', 'Day']),
      });
    });
  });

  describe('setAggregateCapabilities', () => {
    class CollectionWithRestrictedAggregation extends ConcreteCollection {
      constructor() {
        super();

        this.setAggregateCapabilities({
          supportGroups: false,
          supportDateOperations: new Set(),
        });
      }
    }

    it('should override aggregate capabilities', () => {
      const collection = new CollectionWithRestrictedAggregation();

      expect(collection.schema.aggregateCapabilities).toEqual({
        supportGroups: false,
        supportDateOperations: new Set(),
      });
    });
  });

  describe('addField with isGroupable', () => {
    class CollectionWithFields extends ConcreteCollection {
      constructor() {
        super();

        this.addField('id', factories.columnSchema.uuidPrimaryKey().build());
        this.addField('title', factories.columnSchema.build());
        this.addField('status', factories.columnSchema.build({ isGroupable: false }));
      }
    }

    it('should default isGroupable to false for primary keys', () => {
      const collection = new CollectionWithFields();
      const field = collection.schema.fields.id as ColumnSchema;
      expect(field.type).toBe('Column');
      expect(field.isGroupable).toBe(false);
    });

    it('should default isGroupable to true for non-PK columns', () => {
      const collection = new CollectionWithFields();
      const field = collection.schema.fields.title as ColumnSchema;
      expect(field.type).toBe('Column');
      expect(field.isGroupable).toBe(true);
    });

    it('should respect explicit isGroupable override', () => {
      const collection = new CollectionWithFields();
      const field = collection.schema.fields.status as ColumnSchema;
      expect(field.type).toBe('Column');
      expect(field.isGroupable).toBe(false);
    });
  });

  describe('execute', () => {
    test('it always throws', async () => {
      const collection = new ConcreteCollection();

      await expect(
        collection.execute(factories.caller.build(), 'someAction', {}),
      ).rejects.toThrow();
    });
  });

  describe('renderChart', () => {
    test('it always throws', async () => {
      const collection = new ConcreteCollection();

      await expect(
        collection.renderChart(factories.caller.build(), 'someChart', [1]),
      ).rejects.toThrow();
    });
  });

  describe('getForm', () => {
    test('it return an empty form', async () => {
      const collection = new ConcreteCollection();

      await expect(
        collection.getForm(factories.caller.build(), 'someAction'),
      ).resolves.toStrictEqual([]);
    });
  });
});
