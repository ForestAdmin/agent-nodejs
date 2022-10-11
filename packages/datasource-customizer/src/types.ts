import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';

import { TCollectionName, TFieldName, TRow, TSchema } from './templates';
import CollectionCustomizationContext from './context/collection-context';
import CollectionCustomizer from './collection-customizer';
import DataSourceCustomizer from './datasource-customizer';

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
  include?: string[];
  exclude?: string[];
};

export type Plugin<Options> = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataSourceCustomizer: DataSourceCustomizer<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collectionCustomizer: CollectionCustomizer<any, any>,
  options?: Options,
) => Promise<void>;
