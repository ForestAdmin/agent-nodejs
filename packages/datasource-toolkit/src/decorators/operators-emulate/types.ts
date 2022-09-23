import {
  TCollectionName,
  TColumnName,
  TConditionTree,
  TFieldType,
  TSchema,
} from '../../interfaces/templates';
import CollectionCustomizationContext from '../../context/collection-context';

export type OperatorDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
  C extends TColumnName<S, N> = TColumnName<S, N>,
> = (
  value: TFieldType<S, N, C>,
  context: CollectionCustomizationContext<S, N>,
) => Promise<TConditionTree<S, N>> | TConditionTree<S, N>;
