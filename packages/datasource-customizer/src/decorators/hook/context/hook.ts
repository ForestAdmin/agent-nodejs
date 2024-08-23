import CollectionCustomizationContext from '../../../context/collection-context';
import { TCollectionName, TSchema } from '../../../templates';

export default abstract class HookContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends CollectionCustomizationContext<S, N> {}
