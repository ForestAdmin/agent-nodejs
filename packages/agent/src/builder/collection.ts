import {
  ActionDefinition,
  CollectionUtils,
  ColumnSchema,
  HookHandler,
  HookPosition,
  HookType,
  HooksContext,
  Operator,
  OperatorDefinition,
  PlainSortClause,
  RecordUtils,
  RelationDefinition,
  SchemaUtils,
  SearchDefinition,
  SegmentDefinition,
  TCollectionName,
  TColumnName,
  TFieldName,
  TSchema,
  WriteDefinition,
} from '@forestadmin/datasource-toolkit';

import { FieldDefinition, OneToManyEmbeddedDefinition } from './types';
import DecoratorsStack from './decorators-stack';
import FrontendFilterableUtils from '../agent/utils/forest-schema/filterable';

export default class CollectionBuilder<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> {
  private readonly name: string;
  private readonly stack: DecoratorsStack;

  constructor(stack: DecoratorsStack, name: string) {
    this.name = name;
    this.stack = stack;
  }

  /**
   * Disable count in list view pagination for improved performance.
   *
   * @example
   * .disableCount()
   */
  disableCount(): this {
    this.stack.schema.getCollection(this.name).overrideSchema({ countable: false });

    return this;
  }

  /**
   * Import a field from a many to one or one to one relation.
   *
   * @param name the name of the field that will be created on the collection
   * @param options options to import the field
   * @example
   * .importField('authorName', { path: 'author:fullName' })
   */
  importField(name: string, options: { path: TFieldName<S, N>; beforeRelations?: boolean }): this {
    const collection = this.stack.lateComputed.getCollection(this.name);
    const schema = CollectionUtils.getFieldSchema(collection, options.path) as ColumnSchema;

    this.addField(name, {
      beforeRelations: options.beforeRelations,
      columnType: schema.columnType,
      defaultValue: schema.defaultValue,
      dependencies: [options.path],
      getValues: records => records.map(r => RecordUtils.getFieldValue(r, options.path)),
      enumValues: schema.enumValues,
    });

    for (const operator of schema.filterOperators) {
      const handler = value => ({ field: options.path, operator, value });
      this.replaceFieldOperator(
        name as TFieldName<S, N>,
        operator,
        handler as OperatorDefinition<S, N>,
      );
    }

    if (schema.isSortable) {
      this.replaceFieldSorting(name as TFieldName<S, N>, [
        { field: options.path, ascending: true },
      ]);
    }

    return this;
  }

  /**
   * Allow to rename a field of a given collection.
   * @param oldName the current name of the field in a given collection
   * @param newName the new name of the field
   * @example
   * .renameField('theCurrentNameOfTheField', 'theNewNameOfTheField');
   */
  renameField(oldName: TColumnName<S, N>, newName: string): this {
    this.stack.renameField.getCollection(this.name).renameField(oldName, newName);

    return this;
  }

  /**
   * Remove field by setting its visibility to false.
   * @param names the fields to remove
   * @example
   * .removeField('aFieldToRemove', 'anotherFieldToRemove');
   */
  removeField(...names: TColumnName<S, N>[]): this {
    const collection = this.stack.publication.getCollection(this.name);
    for (const name of names) collection.changeFieldVisibility(name, false);

    return this;
  }

  /**
   * Add a new action on the collection.
   * @param name the name of the action
   * @param definition the definition of the action
   * @example
   * .addAction('is live', {
   *    scope: 'Single',
   *    execute: async (context, resultBuilder) => {
   *      return resultBuilder.success(`Is live!`);
   *    },
   *  })
   */
  addAction(name: string, definition: ActionDefinition<S, N>): this {
    this.stack.action
      .getCollection(this.name)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .addAction(name, definition as ActionDefinition<any, any>);

    return this;
  }

  /**
   * Add a new field on the collection.
   * @param name the name of the field
   * @param definition The definition of the field
   * @example
   * .addField('fullName', {
   *    columnType: 'String',
   *    dependencies: ['firstName', 'lastName'],
   *    getValues: (records) => records.map(record => `${record.lastName} ${record.firstName}`),
   * });
   */
  addField(name: string, definition: FieldDefinition<S, N>): this {
    const { beforeRelations, ...computedDefinition } = definition;
    const collection = definition.beforeRelations
      ? this.stack.earlyComputed.getCollection(this.name)
      : this.stack.lateComputed.getCollection(this.name);

    collection.registerComputed(name, computedDefinition);

    return this;
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
    this.addRelation(name, {
      type: 'ManyToOne',
      foreignCollection,
      foreignKey: options.foreignKey,
      foreignKeyTarget: options.foreignKeyTarget,
    });

    return this;
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
    this.addRelation(name, {
      type: 'OneToMany',
      foreignCollection,
      originKey: options.originKey,
      originKeyTarget: options.originKeyTarget,
    });

    return this;
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
    this.addRelation(name, {
      type: 'OneToOne',
      foreignCollection,
      originKey: options.originKey,
      originKeyTarget: options.originKeyTarget,
    });

    return this;
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
    this.addRelation(name, {
      type: 'ManyToMany',
      foreignCollection,
      throughCollection,
      originKey: options.originKey,
      originKeyTarget: options.originKeyTarget,
      foreignKey: options.foreignKey,
      foreignKeyTarget: options.foreignKeyTarget,
    });

    return this;
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
    const { schema } = this.stack.action.getCollection(this.name);
    const primaryKeys = SchemaUtils.getPrimaryKeys(schema) as TFieldName<S, N>[];

    return this.addField(name, {
      dependencies: definition.dependencies ?? primaryKeys,
      columnType: [definition.schema],
      getValues: async (records, context) =>
        Promise.all(records.map(async record => definition.listRecords(record, context))),
    });
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
    this.stack.segment.getCollection(this.name).addSegment(name, definition as SegmentDefinition);

    return this;
  }

  /**
   * Enable sorting on a specific field using emulation.
   * As for all the emulation method, the field sorting will be done in-memory.
   * @param name the name of the field to enable emulation on
   * @example
   * .emulateFieldSorting('fullName');
   */
  emulateFieldSorting(name: TColumnName<S, N>): this {
    this.stack.sortEmulate.getCollection(this.name).emulateFieldSorting(name);

    return this;
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
  replaceFieldSorting(name: TColumnName<S, N>, equivalentSort: PlainSortClause<S, N>[]): this {
    this.stack.sortEmulate
      .getCollection(this.name)
      .replaceFieldSorting(name, equivalentSort as PlainSortClause[]);

    return this;
  }

  /**
   * Enable filtering on a specific field using emulation.
   * As for all the emulation method, the field filtering will be done in-memory.
   * @param name the name of the field to enable emulation on
   * @example
   * .emulateFieldFiltering('aField');
   */
  emulateFieldFiltering(name: TColumnName<S, N>): this {
    const collection = this.stack.lateOpEmulate.getCollection(this.name);
    const field = collection.schema.fields[name] as ColumnSchema;

    for (const operator of FrontendFilterableUtils.getRequiredOperators(field.columnType)) {
      if (!field.filterOperators?.has(operator)) {
        this.emulateFieldOperator(name, operator);
      }
    }

    return this;
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
    const collection = this.stack.earlyOpEmulate.getCollection(this.name).schema.fields[name]
      ? this.stack.earlyOpEmulate.getCollection(this.name)
      : this.stack.lateOpEmulate.getCollection(this.name);

    collection.emulateFieldOperator(name, operator);

    return this;
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
    const collection = this.stack.earlyOpEmulate.getCollection(this.name).schema.fields[name]
      ? this.stack.earlyOpEmulate.getCollection(this.name)
      : this.stack.lateOpEmulate.getCollection(this.name);

    collection.replaceFieldOperator(name, operator, replacer as OperatorDefinition);

    return this;
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
    this.stack.write.getCollection(this.name).replaceFieldWriting(name, definition);

    return this;
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
    this.stack.search
      .getCollection(this.name)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .replaceSearch(definition as SearchDefinition<any, any>);

    return this;
  }

  addHook<P extends HookPosition, T extends HookType>(
    position: P,
    type: T,
    handler: HookHandler<HooksContext<S, N>[P][T]>,
  ): this {
    this.stack.hook
      .getCollection(this.name)
      .addHook(position, type, handler as unknown as HookHandler<HooksContext[P][T]>);

    return this;
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
  private addRelation(name: string, definition: RelationDefinition): this {
    this.stack.relation.getCollection(this.name).addRelation(name, definition);

    return this;
  }
}
