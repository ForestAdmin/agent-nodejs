import { PlainConditionTree } from '../../interfaces/query/condition-tree/nodes/base';
import { TCollectionName, TSchema } from '../../interfaces/templates';
import CollectionCustomizationContext from '../../context/collection-context';

export type SearchDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = (
  value: string,
  extended: boolean,
  context: CollectionCustomizationContext<S, N>,
) => Promise<PlainConditionTree<S, N>> | PlainConditionTree<S, N>;
