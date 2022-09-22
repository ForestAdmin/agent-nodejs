import { PlainConditionTree } from '../../interfaces/query/condition-tree/nodes/base';
import { TCollectionName, TColumnName, TFieldType, TSchema } from '../../interfaces/templates';
import CollectionCustomizationContext from '../../context/collection-context';

export type OperatorDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
  C extends TColumnName<S, N> = TColumnName<S, N>,
> = (
  value: TFieldType<S, N, C>,
  context: CollectionCustomizationContext<S, N>,
) => Promise<PlainConditionTree<S, N>> | PlainConditionTree<S, N>;
