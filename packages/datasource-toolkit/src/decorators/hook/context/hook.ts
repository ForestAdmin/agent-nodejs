import { ForbidenError, UnprocessableError, ValidationError } from '../../../errors';
import { TCollectionName, TSchema } from '../../../interfaces/templates';
import CollectionCustomizationContext from '../../../context/collection-context';

export default abstract class HookContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends CollectionCustomizationContext<S, N> {
  throwValidationError(message: string): never {
    throw new ValidationError(message);
  }

  throwForbiddenError(message: string): never {
    throw new ForbidenError(message);
  }

  throwError(message: string): never {
    throw new UnprocessableError(message);
  }
}
