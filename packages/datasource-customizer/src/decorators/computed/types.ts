import { ColumnType } from '@forestadmin/datasource-toolkit';

import CollectionCustomizationContext from '../../context/collection-context';
import {
  TCollectionName,
  TFieldName,
  TFieldNameFromRelation,
  TRow,
  TSchema,
} from '../../templates';

export type ComputedRelationDependencies<S extends TSchema> = {
  readonly [CollectionName in TCollectionName<S>]?: {
    readonly collectionName: CollectionName;
    readonly path: TFieldNameFromRelation<S, CollectionName>;
  };
}[TCollectionName<S>];

export interface ComputedDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> {
  readonly columnType: ColumnType;
  readonly dependencies: TFieldName<S, N>[];

  /**
   * An array specifying computed relation dependencies for the getValues method.
   *
   * The `computedRelationDependencies` property is used to specify dependencies for computed
   * relationships in the `getValues` method. When a user requests a collection that is not
   * directly linked to the current collection but relies on computed relationships, this
   * property ensures that the necessary dependencies are computed first to avoid errors.
   *
   * Each item in the array should be an object with the following properties:
   *
   * - `collectionName` (string): The name of the collection with the computed relationship.
   * - `path` (string): The path to the specific computed relationship within the collection.
   *
   * * @example
   * // Specify the computed relation dependencies for the 'getValues' method
   * // when you are using the context.
   * computedRelationDependencies: [
   *   // author:firstName is a computed relationship in the 'books' collection
   *   // added by the addManyToOne method.
   *   { collectionName: 'books', path: 'author:firstName' },
   *   // Add more dependencies as needed
   * ];
   *
   * // Usage in 'getValues' method
   * getValues: (records, context) => {
   *   // Ensure that computed relations is computed before proceeding.
   *   return context.dataSource.getCollection('books').list({}, ['author:firstName']);
   * }
   */
  readonly computedRelationDependencies?: ComputedRelationDependencies<S>[];
  readonly defaultValue?: unknown;
  readonly enumValues?: string[];

  getValues(
    records: TRow<S, N>[],
    context: CollectionCustomizationContext<S, N>,
  ): Promise<unknown[]> | unknown[];
}
