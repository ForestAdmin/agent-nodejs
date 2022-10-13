import {
  CollectionSchema,
  CollectionUtils,
  ColumnSchema,
  Operator,
  allowedOperatorsForColumnType,
} from '@forestadmin/datasource-toolkit';

import { ActionDefinition } from './decorators/actions/types/actions';
import { ComputedDefinition } from './decorators/computed/types';
import { HookHandler, HookPosition, HookType, HooksContext } from './decorators/hook/types';
import { OneToManyEmbeddedDefinition, Plugin } from './types';
import { OperatorDefinition } from './decorators/operators-emulate/types';
import { RelationDefinition } from './decorators/relation/types';
import { SearchDefinition } from './decorators/search/types';
import { SegmentDefinition } from './decorators/segment/types';
import { TCollectionName, TColumnName, TFieldName, TSchema, TSortClause } from './templates';
import { WriteDefinition } from './decorators/write/types';
import DataSourceCustomizer from './datasource-customizer';
import DecoratorsStack from './decorators/decorators-stack';
import addExternalRelation from './plugins/add-external-relation';
import importField from './plugins/import-field';

export default class CollectionCustomizer<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> {
  private readonly dataSourceCustomizer: DataSourceCustomizer<S>;
  private readonly stack: DecoratorsStack;
  readonly name: string;

  get schema(): CollectionSchema {
    return this.stack.hook.getCollection(this.name).schema;
  }

  constructor(dataSourceCustomizer: DataSourceCustomizer<S>, stack: DecoratorsStack, name: string) {
    this.dataSourceCustomizer = dataSourceCustomizer;
    this.name = name;
    this.stack = stack;
  }

  /**
   * Load a plugin on the collection.
   * @param plugin reference to the plugin function
   * @param options options to pass to the plugin
   * @example
   * import { createFileField } from '@forestadmin/plugin-s3';
   *
   * collection.use(createFileField, { fieldname: 'avatar' }),
   */
  use<Options>(plugin: Plugin<Options>, options?: Options): this {
    return this.pushCustomization(async () => {
      await plugin(this.dataSourceCustomizer, this, options);
    });
  }

  /**
   * Disable count in list view pagination for improved performance.
   *
   * @example
   * .disableCount()
   */
  disableCount(): this {
    return this.pushCustomization(async () => {
      this.stack.schema.getCollection(this.name).overrideSchema({ countable: false });
    });
  }

  /**
   * Import a field from a many to one or one to one relation.
   *
   * @param name the name of the field that will be created on the collection
   * @param options options to import the field
   * @example
   * .importField('authorName', { path: 'author:fullName' })
   */
  importField(name: string, options: { path: TFieldName<S, N>; readonly?: boolean }): this {
    return this.use(importField, { name, ...options });
  }

  /**
   * Allow to rename a field of a given collection.
   * @param oldName the current name of the field in a given collection
   * @param newName the new name of the field
   * @example
   * .renameField('theCurrentNameOfTheField', 'theNewNameOfTheField');
   */
  renameField(oldName: TColumnName<S, N>, newName: string): this {
    return this.pushCustomization(async () => {
      this.stack.renameField.getCollection(this.name).renameField(oldName, newName);
    });
  }

  /**
   * Remove field by setting its visibility to false.
   * @param names the fields to remove
   * @example
   * .removeField('aFieldToRemove', 'anotherFieldToRemove');
   */
  removeField(...names: TColumnName<S, N>[]): this {
    return this.pushCustomization(async () => {
      const collection = this.stack.publication.getCollection(this.name);
      for (const name of names) collection.changeFieldVisibility(name, false);
    });
  }

  /**
   * Add a new action on the collection.
   * @param name the name of the action
   * @param definition the definition of the action
   * @example
   * .addAction('is live', {
   *    scope: 'Single',
   *    execute: async (context, resultBuilder) => {
   *      return resultBuilder.success('Is live!');
   *    },
   *  })
   */
  addAction(name: string, definition: ActionDefinition<S, N>): this {
    return this.pushCustomization(async () => {
      this.stack.action
        .getCollection(this.name)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .addAction(name, definition as ActionDefinition<any, any>);
    });
  }

  /**
   * Add a new field on the collection.
   * @param name the name of the field
   * @param definition The definition of the field
   * @example
   * .addField('fullName', {
   *    columnType: 'String',
   *    dependencies: ['firstName', 'lastName'],
   *    getValues: (records) => records.map(record => \`${record.lastName} ${record.firstName}\`),
   * });
   */
  addField(name: string, definition: ComputedDefinition<S, N>): this {
    return this.pushCustomization(async () => {
      const collectionBeforeRelations = this.stack.earlyComputed.getCollection(this.name);
      const collectionAfterRelations = this.stack.lateComputed.getCollection(this.name);
      const canBeComputedBeforeRelations = definition.dependencies.every(field => {
        try {
          return !!CollectionUtils.getFieldSchema(collectionBeforeRelations, field);
        } catch {
          return false;
        }
      });

      const collection = canBeComputedBeforeRelations
        ? collectionBeforeRelations
        : collectionAfterRelations;

      collection.registerComputed(name, definition as ComputedDefinition);
    });
  }

  /**
   * Add a new validator to the edition form of a given field
   * @param name The name of the field
   * @param operator The validator that you wish to add
   * @param value A configuration value that the validator may need
   * @example
   * .addFieldValidation('firstName', 'LongerThan', 2);
   */
  addFieldValidation(name: TColumnName<S, N>, operator: Operator, value?: unknown): this {
    return this.pushCustomization(async () => {
      this.stack.validation.getCollection(this.name).addValidation(name, { operator, value });
    });
  }

  /**
   * Add a many to one relation to the collection
   * @param name name of the new relation
   * @param foreignCollection name of the targeted collection
   * @param options extra information about the relation
   * @example
   * books.addManyToOneRelation('myAuthor', 'persons', { foreignKey: 'authorId' })
   */
  addManyToOneRelation<T extends TCollectionName<S>>(
    name: string,
    foreignCollection: T,
    options: { foreignKey: TColumnName<S, N>; foreignKeyTarget?: TColumnName<S, T> },
  ): this {
    return this.pushRelation(name, {
      type: 'ManyToOne',
      foreignCollection,
      foreignKey: options.foreignKey,
      foreignKeyTarget: options.foreignKeyTarget,
    });
  }

  /**
   * Add a one to many relation to the collection
   * @param name name of the new relation
   * @param foreignCollection name of the targeted collection
   * @param options extra information about the relation
   * @example
   * persons.addOneToManyRelation('writtenBooks', 'books', { originKey: 'authorId' })
   */
  addOneToManyRelation<T extends TCollectionName<S>>(
    name: string,
    foreignCollection: T,
    options: { originKey: TColumnName<S, T>; originKeyTarget?: TColumnName<S, N> },
  ): this {
    return this.pushRelation(name, {
      type: 'OneToMany',
      foreignCollection,
      originKey: options.originKey,
      originKeyTarget: options.originKeyTarget,
    });
  }

  /**
   * Add a one to one relation to the collection
   * @param name name of the new relation
   * @param foreignCollection name of the targeted collection
   * @param options extra information about the relation
   * @example
   * persons.addOneToOneRelation('bestFriend', 'persons', { originKey: 'bestFriendId' })
   */
  addOneToOneRelation<T extends TCollectionName<S>>(
    name: string,
    foreignCollection: T,
    options: { originKey: TColumnName<S, T>; originKeyTarget?: TColumnName<S, N> },
  ): this {
    return this.pushRelation(name, {
      type: 'OneToOne',
      foreignCollection,
      originKey: options.originKey,
      originKeyTarget: options.originKeyTarget,
    });
  }

  /**
   * Add a many to many relation to the collection
   * @param name name of the new relation
   * @param foreignCollection name of the targeted collection
   * @param throughCollection name of the intermediary collection
   * @param options extra information about the relation
   * @example
   * dvds.addManyToManyRelation('rentalsOfThisDvd', 'rentals', 'dvdRentals', {
   *   originKey: 'dvdId',
   *   foreignKey: 'rentalId'
   * })
   */
  addManyToManyRelation<Foreign extends TCollectionName<S>, Through extends TCollectionName<S>>(
    name: string,
    foreignCollection: Foreign,
    throughCollection: Through,
    options: {
      originKey: TColumnName<S, Through>;
      foreignKey: TColumnName<S, Through>;
      originKeyTarget?: TColumnName<S, N>;
      foreignKeyTarget?: TColumnName<S, Foreign>;
    },
  ): this {
    return this.pushRelation(name, {
      type: 'ManyToMany',
      foreignCollection,
      throughCollection,
      originKey: options.originKey,
      originKeyTarget: options.originKeyTarget,
      foreignKey: options.foreignKey,
      foreignKeyTarget: options.foreignKeyTarget,
    });
  }

  /**
   * Add a virtual collection into the related data of a record.
   *
   * @param name name of the relation
   * @param definition the definition of the new relation
   * @example
   * .addExternalRelation('states', {
   *   schema: { code: 'Number', name: 'String' },
   *   listRecords: ({ id }) => {
   *     return record.id == 34 ?
   *      [{ code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }] :
   *      [{ code: 'AZ', name: 'Arizona' }, { code: 'TX', name: 'Texas' }];
   *   }
   * })
   */
  addExternalRelation(name: string, definition: OneToManyEmbeddedDefinition<S, N>): this {
    return this.use(addExternalRelation, { name, ...definition });
  }

  /**
   * Add a new segment on the collection.
   * @param name the name of the segment
   * @param definition a function used to generate a condition tree
   * or a condition tree
   * @example
   * .addSegment(
   *    'Wrote more than 2 books',
   *    { field: 'booksCount', operator: 'GreaterThan', value: 2 }
   * );
   */
  addSegment(name: string, definition: SegmentDefinition<S, N>): this {
    return this.pushCustomization(async () => {
      this.stack.segment.getCollection(this.name).addSegment(name, definition as SegmentDefinition);
    });
  }

  /**
   * Enable sorting on a specific field using emulation.
   * As for all the emulation method, the field sorting will be done in-memory.
   * @param name the name of the field to enable emulation on
   * @example
   * .emulateFieldSorting('fullName');
   */
  emulateFieldSorting(name: TColumnName<S, N>): this {
    return this.pushCustomization(async () => {
      this.stack.sortEmulate.getCollection(this.name).emulateFieldSorting(name);
    });
  }

  /**
   * Replace an implementation for the sorting.
   * The field sorting will be done by the datasource.
   * @param name the name of the field to enable sort
   * @param equivalentSort the sort equivalent
   * @example
   * .replaceFieldSorting(
   *   'fullName',
   *   [
   *     { field: 'firstName', ascending: true },
   *     { field: 'lastName',  ascending: true },
   *   ]
   * )
   */
  replaceFieldSorting(name: TColumnName<S, N>, equivalentSort: TSortClause<S, N>[]): this {
    return this.pushCustomization(async () => {
      this.stack.sortEmulate
        .getCollection(this.name)
        .replaceFieldSorting(name, equivalentSort as TSortClause[]);
    });
  }

  /**
   * Enable filtering on a specific field using emulation.
   * As for all the emulation method, the field filtering will be done in-memory.
   * @param name the name of the field to enable emulation on
   * @example
   * .emulateFieldFiltering('aField');
   */
  emulateFieldFiltering(name: TColumnName<S, N>): this {
    return this.pushCustomization(async () => {
      const collection = this.stack.lateOpEmulate.getCollection(this.name);
      const field = collection.schema.fields[name] as ColumnSchema;

      if (typeof field.columnType === 'string') {
        const operators = allowedOperatorsForColumnType[field.columnType];

        for (const operator of operators) {
          if (!field.filterOperators?.has(operator)) {
            this.emulateFieldOperator(name, operator);
          }
        }
      }
    });
  }

  /**
   * Enable filtering on a specific field with a specific operator using emulation.
   * As for all the emulation method, the field filtering will be done in-memory.
   * @param name the name of the field to enable emulation on
   * @param operator the operator to emulate
   * @example
   * .emulateFieldOperator('aField', 'In');
   */
  emulateFieldOperator(name: TColumnName<S, N>, operator: Operator): this {
    return this.pushCustomization(async () => {
      const collection = this.stack.earlyOpEmulate.getCollection(this.name).schema.fields[name]
        ? this.stack.earlyOpEmulate.getCollection(this.name)
        : this.stack.lateOpEmulate.getCollection(this.name);

      collection.emulateFieldOperator(name, operator);
    });
  }

  /**
   * Replace an implementation for a specific operator on a specific field.
   * The operator replacement will be done by the datasource.
   * @param name the name of the field to filter on
   * @param operator the operator to replace
   * @param replacer the proposed implementation
   * @example
   * .replaceFieldOperator('fullName', 'Contains', (value) => {
   *    return {
   *      aggregator: 'Or',
   *      conditions: [{
   *        field: 'firstName',
   *        operator: 'Contains',
   *        value
   *      }, {
   *        field: 'lastName',
   *        operator: 'Contains',
   *        value
   *      }]
   *    }
   * });
   */
  replaceFieldOperator<C extends TColumnName<S, N>>(
    name: C,
    operator: Operator,
    replacer: OperatorDefinition<S, N, C>,
  ): this {
    return this.pushCustomization(async () => {
      const collection = this.stack.earlyOpEmulate.getCollection(this.name).schema.fields[name]
        ? this.stack.earlyOpEmulate.getCollection(this.name)
        : this.stack.lateOpEmulate.getCollection(this.name);

      collection.replaceFieldOperator(name, operator, replacer as OperatorDefinition);
    });
  }

  /**
   * Replace the write behavior of a field.
   * @param name the name of the field
   * @param definition the function or a value to represent the write behavior
   * @example
   * .replaceFieldWriting('fullName', fullName => {
   *   const [firstName, lastName] = fullName.split(' ');
   *   return { firstName, lastName };
   * });
   */
  replaceFieldWriting<C extends TColumnName<S, N>>(
    name: C,
    definition: WriteDefinition<S, N, C>,
  ): this {
    return this.pushCustomization(async () => {
      this.stack.write.getCollection(this.name).replaceFieldWriting(name, definition);
    });
  }

  /**
   * Replace the behavior of the search bar
   * @param definition handler to describe the new behavior
   * @example
   * .replaceSearch(async (searchString) => {
   *   return { field: 'name', operator: 'Contains', value: searchString };
   * });
   */
  replaceSearch(definition: SearchDefinition<S, N>): this {
    return this.pushCustomization(async () => {
      this.stack.search
        .getCollection(this.name)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .replaceSearch(definition as SearchDefinition<any, any>);
    });
  }

  addHook<P extends HookPosition, T extends HookType>(
    position: P,
    type: T,
    handler: HookHandler<HooksContext<S, N>[P][T]>,
  ): this {
    return this.pushCustomization(async () => {
      this.stack.hook
        .getCollection(this.name)
        .addHook(position, type, handler as unknown as HookHandler<HooksContext[P][T]>);
    });
  }

  /**
   * Add a relation between two collections.
   * @param name name of the new relation
   * @param definition definition of the new relation
   * @example
   * .addRelation('author', {
   *   type: 'ManyToOne',
   *   foreignCollection: 'persons',
   *   foreignKey: 'authorId'
   * });
   */
  private pushRelation(name: string, definition: RelationDefinition): this {
    return this.pushCustomization(async () => {
      this.stack.relation.getCollection(this.name).addRelation(name, definition);
    });
  }

  private pushCustomization(customization: () => Promise<void>): this {
    this.stack.queueCustomization(customization);

    return this;
  }
}
