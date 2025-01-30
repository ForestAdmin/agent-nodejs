import {
  CollectionSchema,
  CollectionUtils,
  Logger,
  Operator,
  SchemaUtils,
  allowedOperatorsForColumnType,
} from '@forestadmin/datasource-toolkit';

import DataSourceCustomizer from './datasource-customizer';
import { ActionDefinition } from './decorators/actions/types/actions';
import { BinaryMode } from './decorators/binary/types';
import { CollectionChartDefinition } from './decorators/chart/types';
import { ComputedDefinition } from './decorators/computed/types';
import mapDeprecated from './decorators/computed/utils/map-deprecated';
import DecoratorsStackBase from './decorators/decorators-stack-base';
import { HookHandler, HookPosition, HookType, HooksContext } from './decorators/hook/types';
import { OperatorDefinition } from './decorators/operators-emulate/types';
import {
  CreateOverrideHandler,
  DeleteOverrideHandler,
  UpdateOverrideHandler,
} from './decorators/override/types';
import { RelationDefinition } from './decorators/relation/types';
import { SearchDefinition } from './decorators/search/types';
import { SegmentDefinition } from './decorators/segment/types';
import { WriteDefinition } from './decorators/write/write-replace/types';
import addExternalRelation from './plugins/add-external-relation';
import importField from './plugins/import-field';
import {
  TCollectionName,
  TColumnName,
  TColumnNameAndRelationName,
  TFieldName,
  TSchema,
  TSortClause,
} from './templates';
import { OneToManyEmbeddedDefinition, Plugin } from './types';

export default class CollectionCustomizer<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> {
  private readonly dataSourceCustomizer: DataSourceCustomizer<S>;
  private readonly stack: DecoratorsStackBase;
  readonly name: string;

  get schema(): CollectionSchema {
    return this.stack.validation.getCollection(this.name).schema;
  }

  constructor(
    dataSourceCustomizer: DataSourceCustomizer<S>,
    stack: DecoratorsStackBase,
    name: string,
  ) {
    this.dataSourceCustomizer = dataSourceCustomizer;
    this.name = name;
    this.stack = stack;
  }

  /**
   * Load a plugin on the collection.
   * @param plugin reference to the plugin function
   * @param options options to pass to the plugin
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/plugins Documentation Link}
   * @example
   * import { createFileField } from '@forestadmin/plugin-s3';
   *
   * collection.use(createFileField, { fieldname: 'avatar' }),
   */
  use<Options>(plugin: Plugin<Options>, options?: Options): this {
    return this.pushCustomization(async (logger: Logger) => {
      await plugin(this.dataSourceCustomizer, this, options, logger);
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
   * Disable search on the collection
   *
   * * @example
   * .disableSearch()
   */
  disableSearch(): this {
    return this.pushCustomization(async () => {
      this.stack.search.getCollection(this.name).disable();
    });
  }

  /**
   * Import a field from a many to one or one to one relation.
   *
   * @param name the name of the field that will be created on the collection
   * @param options options to import the field
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/fields/import-rename-remove#moving-fields Documentation Link}
   *
   * @example
   * .importField('authorName', { path: 'author:fullName' })
   */
  importField(name: string, options: { path: TFieldName<S, N>; readonly?: boolean }): this {
    return this.use(importField, { name, ...options });
  }

  /**
   * Rename fields from the exported schema.
   * @param currentName the current name of the field or the relation in a given collection
   * @param newName the new name of the field or the relation
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/fields/import-rename-remove#renaming-and-removing-fields Documentation Link}
   * @example
   * .renameField('currentFieldOrRelationName', 'newFieldOrRelationName')
   */
  renameField(currentName: TColumnNameAndRelationName<S, N>, newName: string): this {
    return this.pushCustomization(async () => {
      this.stack.renameField.getCollection(this.name).renameField(currentName, newName);
    });
  }

  /**
   * Remove fields from the exported schema (they will still be usable within the agent).
   * @param names the names of the field or the relation
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/fields/import-rename-remove#renaming-and-removing-fields Documentation Link}
   * @example
   * .removeField('fieldNameToRemove', 'relationNameToRemove');
   */
  removeField(...names: TColumnNameAndRelationName<S, N>[]): this {
    return this.pushCustomization(async () => {
      const collection = this.stack.publication.getCollection(this.name);
      for (const name of names) collection.changeFieldVisibility(name, false);
    });
  }

  /**
   * Add a new action on the collection.
   * @param name the name of the action
   * @param definition the definition of the action
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/actions Documentation Link}
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
   * Create a new API chart
   * @param name name of the chart
   * @param definition definition of the chart
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/charts Documentation Link}
   * @example
   * .addChart('numCustomers', (context, resultBuilder) => {
   *   return resultBuilder.distribution({
   *     tomatoes: 10,
   *     potatoes: 20,
   *     carrots: 30,
   *   });
   * })
   */
  addChart(name: string, definition: CollectionChartDefinition<S, N>): this {
    return this.pushCustomization(async () => {
      this.stack.chart.getCollection(this.name).addChart(name, definition);
    });
  }

  /**
   * Add a new field on the collection.
   * @param name the name of the field
   * @param definition The definition of the field
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/fields/computed Documentation Link}
   * @example
   * .addField('fullName', {
   *    columnType: 'String',
   *    dependencies: ['firstName', 'lastName'],
   *    getValues: (records) => records.map(record => \`${record.lastName} ${record.firstName}\`),
   * });
   */
  addField: {
    (name: string, definition: ComputedDefinition<S, N>): CollectionCustomizer<S, N>;
  } = (name: string, definition: ComputedDefinition<S, N>): this => {
    return this.pushCustomization(async (logger: Logger) => {
      const collectionBeforeRelations = this.stack.earlyComputed.getCollection(this.name);
      const collectionAfterRelations = this.stack.lateComputed.getCollection(this.name);

      if (definition.columnType === 'Timeonly') {
        logger('Warn', `'Timeonly' is deprecated. Use 'Time' as your columnType instead`);
      }

      if (!definition.dependencies) {
        logger(
          'Error',
          `Computed field '${
            this.stack.validation.getCollection(this.name).name
          }.${name}' must have the 'dependencies' parameter defined`,
        );

        return;
      }

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

      collection.registerComputed(name, mapDeprecated<S, N>(definition));
    });
  };

  /**
   * Add a new validator to the edition form of a given field
   * @param name The name of the field
   * @param operator The validator that you wish to add
   * @param value A configuration value that the validator may need
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/fields/validation Documentation Link}
   * @example
   * .addFieldValidation('firstName', 'LongerThan', 2);
   */
  addFieldValidation(name: TColumnName<S, N>, operator: Operator, value?: unknown): this {
    return this.pushCustomization(async () => {
      this.stack.validation.getCollection(this.name).addValidation(name, { operator, value });
    });
  }

  /**
   * Add a new hook handler to an action
   * @param position Either if the hook is executed before or after the action
   * @param type Type of action which should be hooked
   * @param handler Callback that should be executed when the hook is triggered
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/hooks Documentation Link}
   * @example
   * .addHook('Before', 'List', async (context) => {
   *   // Do something before the list action
   * });
   */
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
   * Add a many to one relation to the collection
   * @param name name of the new relation
   * @param foreignCollection name of the targeted collection
   * @param options extra information about the relation
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/relationships/single-record#many-to-one-relations Documentation Link}
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
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/relationships/multiple-records#one-to-many-relations Documentation Link}
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
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/relationships/single-record#one-to-one-relations Documentation Link}
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
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/relationships/multiple-records#many-to-many-relations Documentation Link}
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
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/relationships/multiple-records#external-relations Documentation Link}
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
   * @param definition a function used to generate a condition tree or a condition tree
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/segments Documentation Link}
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
   * Disable sorting on a specific field.
   * @param name the name of the field with sorting to be disabled
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/fields/sort#disabling-sort Documentation Link}
   * @example
   * .disableFieldSorting('fullName');
   */
  disableFieldSorting(name: TColumnName<S, N>): this {
    return this.pushCustomization(async () => {
      this.stack.sortEmulate.getCollection(this.name).disableFieldSorting(name);
    });
  }

  /**
   * Enable sorting on a specific field using emulation.
   * As for all the emulation method, the field sorting will be done in-memory.
   * @param name the name of the field to enable emulation on
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/fields/sort#emulation Documentation Link}
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
   * @see @{@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/fields/sort Documentation Link}
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
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/fields/filter#emulation Documentation Link}
   * @example
   * .emulateFieldFiltering('aField');
   */
  emulateFieldFiltering(name: TColumnName<S, N>): this {
    return this.pushCustomization(async () => {
      const collection = this.stack.lateOpEmulate.getCollection(this.name);
      const field = SchemaUtils.getColumn(collection.schema, name, collection.name);

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
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/fields/filter Documentation Link}
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
   * Choose how binary data should be transported to the GUI.
   * By default, all fields are transported as 'datauri', with the exception of primary and foreign
   * keys.
   *
   * Using 'datauri' allows to use the FilePicker widget, while 'hex' is more suitable for
   * short binary data (for instance binary uuids).
   *
   * @param name the name of the field
   * @param binaryMode either 'datauri' or 'hex'
   * @example
   * .replaceFieldBinaryMode('avatar', 'datauri');
   */
  replaceFieldBinaryMode(name: TColumnName<S, N>, binaryMode: BinaryMode): this {
    return this.pushCustomization(async () => {
      this.stack.binary.getCollection(this.name).setBinaryMode(name, binaryMode);
    });
  }

  /**
   * Replace an implementation for a specific operator on a specific field.
   * The operator replacement will be done by the datasource.
   * @param name the name of the field to filter on
   * @param operator the operator to replace
   * @param replacer the proposed implementation
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/fields/filter#substitution Documentation Link}
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
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/fields/write Documentation Link}
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
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/search Documentation Link}
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

  /**
   * Replace the default create operation
   * @param handler the new behavior for the create operation
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/hooks/collection-override#custom-create-operation Documentation Link}
   * @example
   * .overrideCreate(async (context) => {
   *   const { data } = context;
   *   const record = await createRecord(data);
   *   return [record];
   * });
   */
  overrideCreate(handler: CreateOverrideHandler<S, N>): this {
    return this.pushCustomization(async () => {
      this.stack.override.getCollection(this.name).addCreateHandler(handler);
    });
  }

  /**
   * Replace the default update operation
   * @param handler the new behavior for the update operation
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/hooks/collection-override#custom-update-operation Documentation Link}
   * @example
   * .overrideUpdate(async (context) => {
   *   const { filter, patch } = context;
   *   await updateRecord(filter, patch);
   * });
   */
  overrideUpdate(handler: UpdateOverrideHandler<S, N>): this {
    return this.pushCustomization(async () => {
      this.stack.override.getCollection(this.name).addUpdateHandler(handler);
    });
  }

  /**
   * Replace the default delete operation
   * @param handler the new behavior for the delete operation
   * @see {@link https://docs.forestadmin.com/developer-guide-agents-nodejs/agent-customization/hooks/collection-override#custom-delete-operation Documentation Link}
   * @example
   * .overrideDelete(async (context) => {
   *   const { filter } = context;
   *   await deleteRecord(filter);
   * });
   */
  overrideDelete(handler: DeleteOverrideHandler<S, N>): this {
    return this.pushCustomization(async () => {
      this.stack.override.getCollection(this.name).addDeleteHandler(handler);
    });
  }

  private pushRelation(name: string, definition: RelationDefinition): this {
    return this.pushCustomization(async () => {
      this.stack.relation.getCollection(this.name).addRelation(name, definition);
    });
  }

  private pushCustomization(customization: (logger: Logger) => Promise<void>): this {
    this.stack.queueCustomization(customization);

    return this;
  }
}
