import { ColumnType } from '../../interfaces/schema';
import { TCollectionName, TFieldName, TRow, TSchema } from '../../interfaces/templates';
import CollectionCustomizationContext from '../../context/collection-context';

export interface ComputedDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> {
  readonly columnType: ColumnType;
  readonly dependencies: TFieldName<S, N>[];
  readonly defaultValue?: unknown;
  readonly enumValues?: string[];

  getValues(
    records: TRow<S, N>[],
    context: CollectionCustomizationContext<S, N>,
  ): Promise<unknown[]> | unknown[];
}
