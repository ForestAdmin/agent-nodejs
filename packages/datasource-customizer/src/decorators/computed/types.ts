import type CollectionCustomizationContext from '../../context/collection-context';
import type { TCollectionName, TFieldName, TRow, TSchema } from '../../templates';
import type { ColumnType } from '@forestadmin/datasource-toolkit';

export interface ComputedDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> {
  readonly columnType: ColumnType;
  readonly dependencies: [TFieldName<S, N>, ...TFieldName<S, N>[]];
  readonly defaultValue?: unknown;
  readonly enumValues?: string[];

  getValues(
    records: TRow<S, N>[],
    context: CollectionCustomizationContext<S, N>,
  ): Promise<unknown[]> | unknown[];
}
