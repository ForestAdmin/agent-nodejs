import CollectionCustomizationContext from '../../../context/collection-context';
import { TCollectionName, TSchema } from '../../../templates';

export default abstract class WebhookContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends CollectionCustomizationContext<S, N> {}
