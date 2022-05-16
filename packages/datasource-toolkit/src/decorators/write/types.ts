import {
  TCollectionName,
  TFieldName,
  TFieldType,
  TPartialRow,
  TSchema,
} from '../../interfaces/templates';
import WriteCustomizationContext from './context';

export type WriteDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
  C extends TFieldName<S, N> = TFieldName<S, N>,
> = (
  value: TFieldType<S, N, C>,
  context: WriteCustomizationContext<S, N>,
) => Promise<TPartialRow<S, N> | void> | TPartialRow<S, N> | void;
