import type CollectionCustomizer from './collection-customizer';
import type CollectionCustomizationContext from './context/collection-context';
import type DataSourceCustomizer from './datasource-customizer';
import type { TCollectionName, TFieldName, TRow, TSchema } from './templates';
import type { Logger, PrimitiveTypes } from '@forestadmin/datasource-toolkit';

export type OneToManyEmbeddedDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = {
  schema: Record<string, PrimitiveTypes>;
  dependencies?: [TFieldName<S, N>, ...TFieldName<S, N>[]];
  listRecords(
    record: TRow<S, N>,
    context: CollectionCustomizationContext<S, N>,
  ): Promise<unknown[]> | unknown[];
};

export type DataSourceOptions = {
  rename?: ((oldName: string) => string) | { [oldName: string]: string };
  include?: string[];
  exclude?: string[];
};

export type Plugin<Options> = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataSourceCustomizer: DataSourceCustomizer<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collectionCustomizer: CollectionCustomizer<any, any>,
  options?: Options,
  logger?: Logger,
) => Promise<void> | void;
