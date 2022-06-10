import { ForbidenError, UnprocessableError, ValidationError } from '../../../errors';
import { TCollectionName, TSchema } from '../../../interfaces/templates';
import CollectionCustomizationContext from '../../../context/collection-context';

export default abstract class HookContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends CollectionCustomizationContext<S, N> {
  /**
   * Stop hooks execution and send Validation error to the UI
   * @param message the validation error message
   */
  throwValidationError(message: string): never {
    throw new ValidationError(message);
  }

  /**
   * Stop hooks execution and send Forbidden error to the UI
   * @param message the forbidden error message
   */
  throwForbiddenError(message: string): never {
    throw new ForbidenError(message);
  }

  /**
   * Stop hooks execution and send error to the UI
   * @param message the error message
   */
  throwError(message: string): never {
    throw new UnprocessableError(message);
  }
}
