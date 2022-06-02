import { DecoratorError, ForbidenDecoratorError } from '../../../errors';
import { TCollectionName, TSchema } from '../../../interfaces/templates';
import CollectionCustomizationContext from '../../../context/collection-context';

export default abstract class HookContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends CollectionCustomizationContext<S, N> {
  forbidden(errorMessage: string) {
    throw new ForbidenDecoratorError(errorMessage);
  }

  error(errorMessage: string) {
    throw new DecoratorError(errorMessage);
  }
}
