import { ColumnType } from '@forestadmin/datasource-toolkit';

import CollectionCustomizationContext from '../../context/collection-context';
import {
  TCollectionName,
  TFieldName,
  TFieldNameFromRelation,
  TRow,
  TSchema,
} from '../../templates';

export type ForeignRelationDependency<S extends TSchema> = {
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
  readonly foreignRelationDependencies?: ForeignRelationDependency<S>[];
  readonly defaultValue?: unknown;
  readonly enumValues?: string[];

  getValues(
    records: TRow<S, N>[],
    context: CollectionCustomizationContext<S, N>,
  ): Promise<unknown[]> | unknown[];
}
