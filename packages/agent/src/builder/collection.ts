import {
  ActionDefinition,
  CollectionUtils,
  ColumnSchema,
  Operator,
  OperatorDefinition,
  PlainSortClause,
  RecordUtils,
  RelationDefinition,
  SegmentDefinition,
  WriteDefinition,
} from '@forestadmin/datasource-toolkit';
import { FieldDefinition } from './types';
import DecoratorsStack from './decorators-stack';
import FrontendFilterableUtils from '../agent/utils/forest-schema/filterable';

export default class CollectionBuilder {
  private readonly name: string;
  private readonly stack: DecoratorsStack;

  constructor(stack: DecoratorsStack, name: string) {
    this.name = name;
    this.stack = stack;
  }

  /**
   * Import a field from a many to one or one to one relation.
   *
   * @param name the name of the field that will be created on the collection
   * @param options options to import the field
   * @example
   * .importField('authorName', { path: 'author:fullName' })
   */
  importField(name: string, options: { path: string; beforeRelations?: boolean }): this {
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
      const handler = (value: unknown) => ({ field: options.path, operator, value });
      this.replaceFieldOperator(name, operator, handler);
    }

    if (schema.isSortable) {
      this.replaceFieldSorting(name, [{ field: options.path, ascending: true }]);
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
  renameField(oldName: string, newName: string): this {
    this.stack.rename.getCollection(this.name).renameField(oldName, newName);

    return this;
  }

  /**
   * Remove field by setting its visibility to false.
   * @param names the fields to remove
   * @example
   * .removeField('aFieldToRemove', 'anOtherFieldToRemove');
   */
  removeField(...names: string[]): this {
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
  addAction(name: string, definition: ActionDefinition): this {
    this.stack.action.getCollection(this.name).addAction(name, definition);

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
  addField(name: string, definition: FieldDefinition): this {
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
   * books.addManyToOne('myAuthor', 'persons', { foreignKey: 'author_id' })
   */
  addManyToOne(
    name: string,
    foreignCollection: string,
    options: { foreignKey: string; foreignKeyTarget?: string },
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
   * persons.addOneToMany('writtenBooks', 'books', { originKey: 'author_id' })
   */
  addOneToMany(
    name: string,
    foreignCollection: string,
    options: { originKey: string; originKeyTarget?: string },
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
   * persons.addOneToOne('bestFriend', 'persons', { originKey: 'best_friend_id' })
   */
  addOneToOne(
    name: string,
    foreignCollection: string,
    options: { originKey: string; originKeyTarget?: string },
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
   * dvds.addManyToMany('rentalsOfThisDvd', 'rentals', 'dvd_rentals', {
   *   originKey: 'dvd_id',
   *   foreignKey: 'rental_id'
   * })
   */
  addManyToMany(
    name: string,
    foreignCollection: string,
    throughCollection: string,
    options: {
      originKey: string;
      foreignKey: string;
      originKeyTarget?: string;
      foreignKeyTarget?: string;
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
   * Add a new segment on the collection.
   * @param name the name of the segment
   * @param definition a function used to generate a condition tree
   * or a condition tree
   * @example
   * .addSegment(
   *    'Wrote more than 2 books',
   *    new ConditionTreeLeaf('booksCount', 'GreaterThan', 2),
   * );
   */
  addSegment(name: string, definition: SegmentDefinition): this {
    this.stack.segment.getCollection(this.name).addSegment(name, definition);

    return this;
  }

  /**
   * Enable sorting on a specific field using emulation.
   * As for all the emulation method, the field sorting will be done in-memory.
   * @param name the name of the field to enable emulation on
   * @example
   * .emulateFieldSorting('fullName');
   */
  emulateFieldSorting(name: string): this {
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
  replaceFieldSorting(name: string, equivalentSort: PlainSortClause[]): this {
    this.stack.sortEmulate.getCollection(this.name).replaceFieldSorting(name, equivalentSort);

    return this;
  }

  /**
   * Enable filtering on a specific field using emulation.
   * As for all the emulation method, the field filtering will be done in-memory.
   * @param name the name of the field to enable emulation on
   * @example
   * .emulateFieldFiltering('aField');
   */
  emulateFieldFiltering(name: string): this {
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
  emulateFieldOperator(name: string, operator: Operator): this {
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
   * .replaceFieldOperator('booksCount', 'Equal', ({ value }) => new ConditionTreeNot(
   *   new ConditionTreeLeaf('booksCount', 'Equal', value),
   * ));
   */
  replaceFieldOperator(name: string, operator: Operator, replacer: OperatorDefinition): this {
    const collection = this.stack.earlyOpEmulate.getCollection(this.name).schema.fields[name]
      ? this.stack.earlyOpEmulate.getCollection(this.name)
      : this.stack.lateOpEmulate.getCollection(this.name);

    collection.replaceFieldOperator(name, operator, replacer);

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
  replaceFieldWriting(name: string, definition: WriteDefinition): this {
    this.stack.write.getCollection(this.name).replaceFieldWriting(name, definition);

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
