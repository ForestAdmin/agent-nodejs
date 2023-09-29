import {
  ColumnType,
  ManyToManySchema,
  ManyToOneSchema,
  OneToManySchema,
  OneToOneSchema,
} from '@forestadmin/datasource-toolkit';

import CollectionCustomizationContext from '../../context/collection-context';
import { TCollectionName, TFieldName, TRow, TSchema } from '../../templates';

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

export interface DeprecatedComputedDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends Omit<ComputedDefinition<S, N>, 'columnType'> {
  readonly columnType: 'Timeonly';
}

type PartialBy<T, K extends Extract<keyof T, string>> = Omit<T, K> & Partial<Pick<T, K>>;

export type RelationDefinition =
  | PartialBy<ManyToOneSchema, 'foreignKeyTarget'>
  | PartialBy<OneToManySchema | OneToOneSchema, 'originKeyTarget'>
  | PartialBy<ManyToManySchema, 'foreignKeyTarget' | 'originKeyTarget'>;
