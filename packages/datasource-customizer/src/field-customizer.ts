import { Operator } from '@forestadmin/datasource-toolkit';

import CollectionCustomizer from './collection-customizer';
import { ComputedDefinition } from './decorators/computed/types';
import { OperatorDefinition } from './decorators/operators-emulate/types';
import { WriteDefinition } from './decorators/write/write-replace/types';
import { TCollectionName, TColumnName, TFieldName, TSchema, TSortClause } from './templates';

export default class FieldCustomizer<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
  C extends TColumnName<S, N> = TColumnName<S, N>,
> {
  private readonly collectionCustomizer: CollectionCustomizer<S, N>;
  readonly name: C;

  constructor(collectionCustomizer: CollectionCustomizer<S, N>, name: C) {
    this.collectionCustomizer = collectionCustomizer;
    this.name = name;
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
  define(definition: ComputedDefinition<S, N>): this {
    this.collectionCustomizer.addField(this.name, definition);

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
  import(options: { path: TFieldName<S, N>; readonly?: boolean }): this {
    this.collectionCustomizer.importField(this.name, options);

    return this;
  }

  /**
   * Allow to rename a field of a given collection.
   * @param oldName the current name of the field in a given collection
   * @param newName the new name of the field
   * @example
   * .renameField('theCurrentNameOfTheField', 'theNewNameOfTheField');
   */
  rename(newName: string): this {
    this.collectionCustomizer.renameField(this.name, newName);

    return this;
  }

  /**
   * Remove field by setting its visibility to false.
   * @param names the fields to remove
   * @example
   * .removeField('aFieldToRemove', 'anotherFieldToRemove');
   */
  remove(): this {
    this.collectionCustomizer.removeField(this.name);

    return this;
  }

  /**
   * Add a new validator to the edition form of a given field
   * @param name The name of the field
   * @param operator The validator that you wish to add
   * @param value A configuration value that the validator may need
   * @example
   * .addFieldValidation('firstName', 'LongerThan', 2);
   */
  addValidation(operator: Operator, value?: unknown): this {
    this.collectionCustomizer.addFieldValidation(this.name, operator, value);

    return this;
  }

  /**
   * Enable sorting on a specific field using emulation.
   * As for all the emulation method, the field sorting will be done in-memory.
   * @param name the name of the field to enable emulation on
   * @example
   * .emulateFieldSorting('fullName');
   */
  emulateSorting(): this {
    this.collectionCustomizer.emulateFieldSorting(this.name);

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
  replaceSorting(equivalentSort: TSortClause<S, N>[]): this {
    this.collectionCustomizer.replaceFieldSorting(this.name, equivalentSort);

    return this;
  }

  /**
   * Enable filtering on a specific field using emulation.
   * As for all the emulation method, the field filtering will be done in-memory.
   * @param name the name of the field to enable emulation on
   * @example
   * .emulateFiltering('aField');
   */
  emulateFiltering(): this {
    this.collectionCustomizer.emulateFieldFiltering(this.name);

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
  emulateOperator(operator: Operator): this {
    this.collectionCustomizer.emulateFieldOperator(this.name, operator);

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
  replaceOperator(operator: Operator, replacer: OperatorDefinition<S, N, C>): this {
    this.collectionCustomizer.replaceFieldOperator(this.name, operator, replacer);

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
  replaceWriting(definition: WriteDefinition<S, N, C>): this {
    this.collectionCustomizer.replaceFieldWriting(this.name, definition);

    return this;
  }
}
