import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';

import { ComputedDefinition } from './decorators/computed/types';
import { TCollectionName, TFieldName, TRow, TSchema } from './templates';
import CollectionCustomizationContext from './context/collection-context';

export type FieldDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = ComputedDefinition<S, N> & {
  beforeRelations?: boolean;
};

export type OneToManyEmbeddedDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = {
  schema: Record<string, PrimitiveTypes>;
  dependencies?: TFieldName<S, N>[];
  listRecords(
    records: TRow<S, N>,
    context: CollectionCustomizationContext<S, N>,
  ): Promise<unknown[]> | unknown[];
};

export type DataSourceOptions = {
  rename?: { [oldName: string]: string };
};
