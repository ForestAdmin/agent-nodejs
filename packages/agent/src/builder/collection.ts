import {
  ActionDefinition,
  CollectionUtils,
  ColumnSchema,
  ConditionTreeLeaf,
  Operator,
  OperatorReplacer,
  PartialRelationSchema,
  Projection,
  RecordUtils,
  SegmentDefinition,
  Sort,
  SortClause,
  WriteDefinition,
} from '@forestadmin/datasource-toolkit';
import { FieldDefinition } from './types';
import AgentBuilder from './agent';

export default class CollectionBuilder {
  private agentBuilder: AgentBuilder;
  private readonly name: string;

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
   * .importField('authorName', { path: 'author:fullName' })
   */
  importField(name: string, options: { path: string; beforeRelations?: boolean }): this {
    const collection = this.agentBuilder.lateComputed.getCollection(this.name);
    const { path, beforeRelations } = options;
    const schema = CollectionUtils.getFieldSchema(collection, options.path) as ColumnSchema;

    this.addField(name, {
      beforeRelations,
      columnType: schema.columnType,
      defaultValue: schema.defaultValue,
      dependencies: new Projection(path),
      getValues: records => records.map(r => RecordUtils.getFieldValue(r, path)),
      enumValues: schema.enumValues,
    });

    for (const operator of schema.filterOperators) {
      const handler = (value: unknown) => new ConditionTreeLeaf(path, operator, value);
      this.replaceFieldOperator(name, operator, handler);
    }

    if (schema.isSortable) {
      this.replaceFieldSorting(name, [{ field: path, ascending: true }]);
    }

    return this;
  }

  /**
   * Allow to rename a field of a given collection.
   * @param {string} oldName the current name of the field in a given collection
   * @param {string} newName the new name of the field
   * @example
   * .renameField('theCurrentNameOfTheField', 'theNewNameOfTheField');
   */
  renameField(oldName: string, newName: string): this {
    this.agentBuilder.rename.getCollection(this.name).renameField(oldName, newName);

    return this;
  }

  /**
   * Remove field by setting its visibility to false.
   * @param {...string[]} names the fields to remove
   * @example
   * .removeField('aFieldToRemove', 'anOtherFieldToRemove');
   */
  removeField(...names: string[]): this {
    const collection = this.agentBuilder.publication.getCollection(this.name);
    for (const name of names) collection.changeFieldVisibility(name, false);

    return this;
  }

  /**
   * Add a new action on the collection.
   * @param {string} name the name of the action
   * @param {ActionDefinition} definition the definition of the action
   * @example
   * .addAction('is live', {
   *    scope: ActionScope.Single,
   *    execute: async (context, responseBuilder) => {
   *      return responseBuilder.success(`Is live!`);
   *    },
   *  })
   */
  addAction(name: string, definition: ActionDefinition): this {
    this.agentBuilder.action.getCollection(this.name).addAction(name, definition);

    return this;
  }

  /**
   * Add a new field on the collection.
   * @param {string} name the name of the field
   * @param {FieldDefinition} definition The definition of the field
   * @example
   * .addField('fullName', {
   *    columnType: PrimitiveTypes.String,
   *    dependencies: ['firstName', 'lastName'],
   *    getValues: (records) => records.map(record => `${record.lastName} ${record.firstName}`),
   * });
   */
  addField(name: string, definition: FieldDefinition): this {
    const { beforeRelations, ...computedDefinition } = definition;
    const collection = definition.beforeRelations
      ? this.agentBuilder.earlyComputed.getCollection(this.name)
      : this.agentBuilder.lateComputed.getCollection(this.name);

    collection.registerComputed(name, computedDefinition);

    return this;
  }

  /**
   * Add a relation between two collections.
   * @param name name of the new relation
   * @param definition definition of the new relation
   * @example
   * .addRelation('author', {
   *   type: FieldTypes.ManyToOne,
   *   foreignCollection: 'persons',
   *   foreignKey: 'authorId'
   * });
   */
  addRelation(name: string, definition: PartialRelationSchema): this {
    this.agentBuilder.relation.getCollection(this.name).addRelation(name, definition);

    return this;
  }

  /**
   * Add a new segment on the collection.
   * @param {string} name the name of the segment
   * @param {SegmentDefinition} definition a function used to generate a condition tree
   * or a condition tree
   * @example
   * .addSegment(
   *    'Wrote more than 2 books',
   *    new ConditionTreeLeaf('booksCount', Operator.GreaterThan, 2),
   * );
   */
  addSegment(name: string, definition: SegmentDefinition) {
    this.agentBuilder.segment.getCollection(this.name).addSegment(name, definition);

    return this;
  }

  /**
   * Enable sorting on a specific field using emulation.
   * As for all the emulation method, the field sorting will be done in-memory.
   * @param {string} name the name of the field to enable emulation on
   * @example
   * .emulateFieldSorting('fullName');
   */
  emulateFieldSorting(name: string): this {
    this.agentBuilder.sortEmulate.getCollection(this.name).emulateFieldSorting(name);

    return this;
  }

  /**
   * Replace an implementation for the sorting.
   * The field sorting will be done by the datasource.
   * @param {string} name the name of the field to enable sort
   * @param {SortClause[]} equivalentSort the sort equivalent
   * @example
   * .replaceFieldSorting(
   *   'fullName',
   *   [
   *     { field: 'firstName', ascending: true },
   *     { field: 'lastName',  ascending: true },
   *   ]
   * )
   */
  replaceFieldSorting(name: string, equivalentSort: SortClause[]): this {
    this.agentBuilder.sortEmulate
      .getCollection(this.name)
      .replaceFieldSorting(name, new Sort(...equivalentSort));

    return this;
  }

  /**
   * Enable filtering on a specific field with a specific operator using emulation.
   * As for all the emulation method, the field filtering will be done in-memory.
   * @param {string} name the name of the field to enable emulation on
   * @param {Operator} operator the operator to emulate
   * @example
   * .emulateFieldOperator('aField', Operator.In);
   */
  emulateFieldOperator(name: string, operator: Operator): this {
    const collection = this.agentBuilder.earlyOpEmulate.getCollection(this.name).schema.fields[name]
      ? this.agentBuilder.earlyOpEmulate.getCollection(this.name)
      : this.agentBuilder.lateOpEmulate.getCollection(this.name);

    collection.emulateFieldOperator(name, operator);

    return this;
  }

  /**
   * Replace an implementation for a specific operator on a specific field.
   * The operator replacement will be done by the datasource.
   * @param {string} name the name of the field to filter on
   * @param {Operator} operator the operator to replace
   * @param {OperatorReplacer} replacer the proposed implementation
   * @example
   * .replaceFieldOperator('booksCount', Operator.Equal, ({ value }) => new ConditionTreeNot(
   *   new ConditionTreeLeaf('booksCount', Operator.Equal, value),
   * ));
   */
  replaceFieldOperator(name: string, operator: Operator, replacer: OperatorReplacer): this {
    const collection = this.agentBuilder.earlyOpEmulate.getCollection(this.name).schema.fields[name]
      ? this.agentBuilder.earlyOpEmulate.getCollection(this.name)
      : this.agentBuilder.lateOpEmulate.getCollection(this.name);

    collection.replaceFieldOperator(name, operator, replacer);

    return this;
  }

  /**
   * Replace the write behavior of a field.
   * @param {string} name the name of the field
   * @param {WriteDefinition} definition the function or a value to represent the write behavior
   * @example
   * .replaceFieldWriting('fullName', ({ patch: fullName }) => {
   *   const [firstName, lastName] = fullName.split(' ');
   *   return { firstName, lastName };
   * });
   */
  replaceFieldWriting(name: string, definition: WriteDefinition): this {
    this.agentBuilder.write.getCollection(this.name).replaceFieldWriting(name, definition);

    return this;
  }
}
