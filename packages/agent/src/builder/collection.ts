import {
  ActionDefinition,
  CollectionUtils,
  ColumnSchema,
  ConditionTree,
  ConditionTreeLeaf,
  Operator,
  OperatorReplacer,
  PartialRelationSchema,
  Projection,
  RecordUtils,
  Sort,
  SortClause,
  WriteHandlerDefinition,
} from '@forestadmin/datasource-toolkit';
import { FieldDefinition } from './types';

import AgentBuilder from './agent';
import FrontendFilterableUtils from '../agent/utils/forest-schema/filterable';

export default class CollectionBuilder {
  private agentBuilder: AgentBuilder;
  private name: string;

  constructor(agentBuilder: AgentBuilder, name: string) {
    this.agentBuilder = agentBuilder;
    this.name = name;
  }

  /**
   * Import a field from a many to one or one to one relation.
   *
   * @param name the name of the field that will be created on the collection
   * @param options options to import the field
   * @example
   * ```
   * .importField('authorName', { path: 'author:fullName' })
   * ```
   */
  importField(name: string, options: { path: string; beforeJointures?: boolean }): this {
    const collection = this.agentBuilder.lateComputed.getCollection(this.name);
    const schema = CollectionUtils.getFieldSchema(collection, options.path) as ColumnSchema;
    const filterBy: Partial<Record<Operator, OperatorReplacer>> = {};

    for (const operator of schema.filterOperators) {
      filterBy[operator] = async value => new ConditionTreeLeaf(options.path, operator, value);
    }

    return this.registerField(name, {
      beforeJointures: options.beforeJointures,
      columnType: schema.columnType,
      defaultValue: schema.defaultValue,
      dependencies: [options.path],
      getValues: records => records.map(r => RecordUtils.getFieldValue(r, options.path)),
      enumValues: schema.enumValues,
      filterBy,
      sortBy: [{ field: options.path, ascending: true }],
    });
  }

  /**
   * Allow to rename a field of a given collection.
   * @param {string} oldName the current name of the field in a given collection
   * @param {string} newName the new name of the field
   * @example
   * ```
   * .renameField('theCurrentNameOfTheFieldIntheCollection', 'theNewNameOfTheField');
   * ```
   */
  renameField(oldName: string, newName: string): this {
    this.agentBuilder.rename.getCollection(this.name).renameField(oldName, newName);

    return this;
  }

  /**
   * Publish an array of fields by setting its visibility to true.
   * @param {string[]} names the array of field to publish
   * @example
   * ```
   * .publishFields(['aFieldToPublish']);
   * ```
   */
  publishFields(names: string[]): this {
    const collection = this.agentBuilder.publication.getCollection(this.name);
    for (const name of names) collection.changeFieldVisibility(name, true);

    return this;
  }

  /**
   * Unpublish an array of fields by setting its visibility to false.
   * @param {string[]} names the array of field to unpublish
   * @example
   * ```
   * .unpublishFields(['aFieldToUnpublish']);
   * ```
   */
  unpublishFields(names: string[]): this {
    const collection = this.agentBuilder.publication.getCollection(this.name);
    for (const name of names) collection.changeFieldVisibility(name, false);

    return this;
  }

  /**
   * Register a new action on the collection
   * @param {string} name the name of the action
   * @param {ActionDefinition} definition the definition of the action
   * @example
   * ```
   * .registerAction('is live', {
        scope: ActionScope.Single,
        execute: async (context, responseBuilder) => {
          return responseBuilder.success(`Is live!`);
        },
      })
   * ```
   */
  registerAction(name: string, definition: ActionDefinition): this {
    this.agentBuilder.action.getCollection(this.name).registerAction(name, definition);

    return this;
  }

  /**
   * Register a new field on the collection.
   * @param {string} name the name of the field
   * @param {RawComputedDefinition} definition The definition of the field
   * @example
   * ```
   * .registerField('fullName', {
   *    columnType: PrimitiveTypes.String,
   *    dependencies: ['firstName', 'lastName'],
   *    getValues: (records) => records.map(record => `${record.lastName} ${record.firstName}`),
   * });
   * ```
   */
  registerField(name: string, definition: FieldDefinition): this {
    // Compute
    const computed = definition.beforeJointures
      ? this.agentBuilder.earlyComputed.getCollection(this.name)
      : this.agentBuilder.lateComputed.getCollection(this.name);

    computed.registerComputed(name, {
      columnType: definition.columnType,
      dependencies: new Projection(...definition.dependencies),
      getValues: definition.getValues,
    });

    // Sort
    if (definition.sortBy) {
      const sort = this.agentBuilder.sortEmulate.getCollection(this.name);
      if (definition.sortBy === 'emulate') sort.emulateSort(name);

      if (Array.isArray(definition.sortBy)) {
        sort.implementSort(name, new Sort(...definition.sortBy));
      }
    }

    // Filter
    if (definition.filterBy) {
      const { filterBy } = definition;
      const operators = FrontendFilterableUtils.getRequiredOperators(definition.columnType) ?? [];
      const operatorEmulate = definition.beforeJointures
        ? this.agentBuilder.earlyOpEmulate.getCollection(this.name)
        : this.agentBuilder.lateOpEmulate.getCollection(this.name);

      for (const operator of operators) {
        const implementation = filterBy === 'emulate' ? 'emulate' : filterBy[operator] ?? 'emulate';
        if (implementation === 'emulate') operatorEmulate.emulateOperator(name, operator);
        else operatorEmulate.implementOperator(name, operator as Operator, implementation);
      }
    }

    return this;
  }

  /**
   * Create a jointure between two collections.
   * @param name name of the new jointure
   * @param definition definition of the new jointure
   * @example
   * ```
   * .registerJointure('author', {
   *   type: FieldTypes.ManyToOne,
   *   foreignCollection: 'persons',
   *   foreignKey: 'authorId'
   * });
   * ```
   */
  registerJointure(name: string, definition: PartialRelationSchema): this {
    this.agentBuilder.jointure.getCollection(this.name).addJointure(name, definition);

    return this;
  }

  /**
   * Register a new segment on the collection.
   * @param {string} name the name of the segment
   * @param {(timezone: string) => Promise<ConditionTree>} conditionTreeGenerator a function used
   *   to generate a condition tree
   * @example
   * ```
   * .registerSegment(
   *    'Wrote more than 2 books',
   *    async (timezone) => new ConditionTreeLeaf('booksCount', Operator.GreaterThan, 2),
   * );
   * ```
   */
  registerSegment(
    name: string,
    conditionTreeGenerator: (timezone: string) => Promise<ConditionTree>,
  ) {
    this.agentBuilder.segment
      .getCollection(this.name)
      .registerSegment(name, conditionTreeGenerator);

    return this;
  }

  /**
   * Enable sorting on a specific field using emulation.
   * As for all the emulation method, the field sorting will be done in-memory.
   * @param {string} name the name of the field to enable emulation on
   * @example
   * ```
   * .emulateSort('fullName');
   * ```
   */
  emulateSort(name: string): this {
    this.agentBuilder.sortEmulate.getCollection(this.name).emulateSort(name);

    return this;
  }

  /**
   * Allow to provide an implementation for the sorting.
   * @param {string} name the name of the field to enable sort
   * @param {SortClause[]} equivalentSort the sort equivalent
   * @example
   * ```
   * .implementSort(
   *   'fullName',
   *   [
   *     { field: 'firstName', ascending: true },
   *     { field: 'lastName',  ascending: true },
   *   ]
   * )
   * ```
   */
  implementSort(name: string, equivalentSort: SortClause[]): this {
    this.agentBuilder.sortEmulate
      .getCollection(this.name)
      .implementSort(name, new Sort(...equivalentSort));

    return this;
  }

  /**
   * Enable filtering on a specific field with a specific operator using emulation.
   * As for all the emulation method, the field filtering will be done in-memory.
   * @param {string} name the name of the field to enable emulation on
   * @param {Operator} operator the operator to emulate
   * @example
   * ```
   * .emulateOperator('aField', Operator.In);
   * ```
   */
  emulateOperator(name: string, operator: Operator): this {
    this.agentBuilder.lateOpEmulate.getCollection(this.name).emulateOperator(name, operator);

    return this;
  }

  /**
   * Allow to provide an implementation for a specific operator on a specific field.
   * @param {string} name the name of the field to filter on
   * @param {Operator} operator the operator to implement
   * @param {OperatorReplacer} replacer the proposed implementation
   * @example
   * ```
   * .implementOperator('booksCount', Operator.Equal, async (value: unknown) => {
   *    return new ConditionTreeNot(
   *      new ConditionTreeLeaf('booksCount', Operator.Equal, value),
   *    );
   * });
   * ```
   */
  implementOperator(name: string, operator: Operator, replacer: OperatorReplacer): this {
    this.agentBuilder.lateOpEmulate
      .getCollection(this.name)
      .implementOperator(name, operator, replacer);

    return this;
  }

  /**
   * Allow override the write behavior of a field.
   * @param {string} name the name of the field
   * {WriteHandlerDefinition} handler the function represent the write behavior.
   * @example
   * ```
   * .implementWrite('fullName', async (patch: unknown, context: WriteHandlerContext) => {
   *   const [firstName, lastName] = patch.split(' ');
   *   return { firstName, lastName };
   * });
   * ```
   */
  implementWrite(name: string, handler: WriteHandlerDefinition): this {
    this.agentBuilder.write.getCollection(this.name).implement(name, handler);

    return this;
  }
}
