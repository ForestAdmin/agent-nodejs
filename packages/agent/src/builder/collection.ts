import {
  ActionCollectionDecorator,
  ActionDefinition,
  CollectionUtils,
  ColumnSchema,
  ComputedCollectionDecorator,
  DataSource,
  DataSourceDecorator,
  Operator,
  OperatorReplacer,
  OperatorsEmulateCollectionDecorator,
  OperatorsReplaceCollectionDecorator,
  PartialRelationSchema,
  PlainSortClause,
  PublicationCollectionDecorator,
  RecordUtils,
  RelationCollectionDecorator,
  RenameCollectionDecorator,
  SearchCollectionDecorator,
  SegmentCollectionDecorator,
  SegmentDefinition,
  SortEmulateCollectionDecorator,
  WriteCollectionDecorator,
  WriteDefinition,
} from '@forestadmin/datasource-toolkit';
import { FieldDefinition } from './types';
import FrontendFilterableUtils from '../agent/utils/forest-schema/filterable';

export default class CollectionBuilder {
  private readonly name: string;

  // Decorators
  static action: DataSourceDecorator<ActionCollectionDecorator>;
  static earlyComputed: DataSourceDecorator<ComputedCollectionDecorator>;
  static earlyOpEmulate: DataSourceDecorator<OperatorsEmulateCollectionDecorator>;
  static earlyOpReplace: DataSourceDecorator<OperatorsReplaceCollectionDecorator>;
  static relation: DataSourceDecorator<RelationCollectionDecorator>;
  static lateComputed: DataSourceDecorator<ComputedCollectionDecorator>;
  static lateOpEmulate: DataSourceDecorator<OperatorsEmulateCollectionDecorator>;
  static lateOpReplace: DataSourceDecorator<OperatorsReplaceCollectionDecorator>;
  static publication: DataSourceDecorator<PublicationCollectionDecorator>;
  static rename: DataSourceDecorator<RenameCollectionDecorator>;
  static search: DataSourceDecorator<SearchCollectionDecorator>;
  static segment: DataSourceDecorator<SegmentCollectionDecorator>;
  static sortEmulate: DataSourceDecorator<SortEmulateCollectionDecorator>;
  static write: DataSourceDecorator<WriteCollectionDecorator>;

  constructor(name: string) {
    this.name = name;
  }

  static init(dataSource: DataSource) {
    let last: DataSource;

    /* eslint-disable no-multi-assign */
    // Step 1: Computed-Relation-Computed sandwich (needed because some emulated relations depend
    // on computed fields, and some computed fields depend on relation...)
    // Note that replacement goes before emulation, as replacements may use emulated operators.
    last = this.earlyComputed = new DataSourceDecorator(dataSource, ComputedCollectionDecorator);
    last = this.earlyOpEmulate = new DataSourceDecorator(last, OperatorsEmulateCollectionDecorator);
    last = this.earlyOpReplace = new DataSourceDecorator(last, OperatorsReplaceCollectionDecorator);
    last = this.relation = new DataSourceDecorator(last, RelationCollectionDecorator);
    last = this.lateComputed = new DataSourceDecorator(last, ComputedCollectionDecorator);
    last = this.lateOpEmulate = new DataSourceDecorator(last, OperatorsEmulateCollectionDecorator);
    last = this.lateOpReplace = new DataSourceDecorator(last, OperatorsReplaceCollectionDecorator);

    // Step 2: Those four need access to all fields. They can be loaded in any order.
    last = this.search = new DataSourceDecorator(last, SearchCollectionDecorator);
    last = this.segment = new DataSourceDecorator(last, SegmentCollectionDecorator);
    last = this.sortEmulate = new DataSourceDecorator(last, SortEmulateCollectionDecorator);
    last = this.write = new DataSourceDecorator(last, WriteCollectionDecorator);

    // Step 3: Access to all fields AND emulated capabilities
    last = this.action = new DataSourceDecorator(last, ActionCollectionDecorator);

    // Step 4: Renaming must be either the very first or very last so that naming in customer code
    // is consistent.
    last = this.publication = new DataSourceDecorator(last, PublicationCollectionDecorator);
    last = this.rename = new DataSourceDecorator(last, RenameCollectionDecorator);

    /* eslint-enable no-multi-assign */
    return last;
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
    const collection = CollectionBuilder.lateComputed.getCollection(this.name);
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
   * @param {string} oldName the current name of the field in a given collection
   * @param {string} newName the new name of the field
   * @example
   * .renameField('theCurrentNameOfTheField', 'theNewNameOfTheField');
   */
  renameField(oldName: string, newName: string): this {
    CollectionBuilder.rename.getCollection(this.name).renameField(oldName, newName);

    return this;
  }

  /**
   * Remove field by setting its visibility to false.
   * @param {...string[]} names the fields to remove
   * @example
   * .removeField('aFieldToRemove', 'anOtherFieldToRemove');
   */
  removeField(...names: string[]): this {
    const collection = CollectionBuilder.publication.getCollection(this.name);
    for (const name of names) collection.changeFieldVisibility(name, false);

    return this;
  }

  /**
   * Add a new action on the collection.
   * @param {string} name the name of the action
   * @param {ActionDefinition} definition the definition of the action
   * @example
   * .addAction('is live', {
   *    scope: 'Single',
   *    execute: async (context, responseBuilder) => {
   *      return responseBuilder.success(`Is live!`);
   *    },
   *  })
   */
  addAction(name: string, definition: ActionDefinition): this {
    CollectionBuilder.action.getCollection(this.name).addAction(name, definition);

    return this;
  }

  /**
   * Add a new field on the collection.
   * @param {string} name the name of the field
   * @param {FieldDefinition} definition The definition of the field
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
      ? CollectionBuilder.earlyComputed.getCollection(this.name)
      : CollectionBuilder.lateComputed.getCollection(this.name);

    collection.registerComputed(name, computedDefinition);

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
  addRelation(name: string, definition: PartialRelationSchema): this {
    CollectionBuilder.relation.getCollection(this.name).addRelation(name, definition);

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
   *    new ConditionTreeLeaf('booksCount', 'GreaterThan', 2),
   * );
   */
  addSegment(name: string, definition: SegmentDefinition): this {
    CollectionBuilder.segment.getCollection(this.name).addSegment(name, definition);

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
    CollectionBuilder.sortEmulate.getCollection(this.name).emulateFieldSorting(name);

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
  replaceFieldSorting(name: string, equivalentSort: PlainSortClause[]): this {
    CollectionBuilder.sortEmulate
      .getCollection(this.name)
      .replaceFieldSorting(name, equivalentSort);

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
    const collection = CollectionBuilder.lateOpEmulate.getCollection(this.name);
    const field = collection.schema.fields[name] as ColumnSchema;

    for (const operator of FrontendFilterableUtils.getRequiredOperators(field.columnType)) {
      if (!field.filterOperators.has(operator)) {
        this.emulateFieldOperator(name, operator);
      }
    }

    return this;
  }

  /**
   * Enable filtering on a specific field with a specific operator using emulation.
   * As for all the emulation method, the field filtering will be done in-memory.
   * @param {string} name the name of the field to enable emulation on
   * @param {Operator} operator the operator to emulate
   * @example
   * .emulateFieldOperator('aField', 'In');
   */
  emulateFieldOperator(name: string, operator: Operator): this {
    const collection = CollectionBuilder.earlyOpEmulate.getCollection(this.name).schema.fields[name]
      ? CollectionBuilder.earlyOpEmulate.getCollection(this.name)
      : CollectionBuilder.lateOpEmulate.getCollection(this.name);

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
   * .replaceFieldOperator('booksCount', 'Equal', ({ value }) => new ConditionTreeNot(
   *   new ConditionTreeLeaf('booksCount', 'Equal', value),
   * ));
   */
  replaceFieldOperator(name: string, operator: Operator, replacer: OperatorReplacer): this {
    const collection = CollectionBuilder.earlyOpEmulate.getCollection(this.name).schema.fields[name]
      ? CollectionBuilder.earlyOpEmulate.getCollection(this.name)
      : CollectionBuilder.lateOpEmulate.getCollection(this.name);

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
    CollectionBuilder.write.getCollection(this.name).replaceFieldWriting(name, definition);

    return this;
  }
}
