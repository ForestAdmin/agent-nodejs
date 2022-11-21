import {
  ForbiddenError,
  UnprocessableError,
  ValidationError,
} from '@forestadmin/datasource-toolkit';

import CollectionCustomizationContext from '../../../context/collection-context';
import { TCollectionName, TSchema } from '../../../templates';

export default abstract class HookContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends CollectionCustomizationContext<S, N> {
  /**
   * Stop hooks execution and send Validation error to the UI
   * @param message the validation error message
   * @example
   * .throwValidationError('My validation error message');
   */
  throwValidationError(message: string): never {
    throw new ValidationError(message);
  }

  /**
   * Stop hooks execution and send Forbidden error to the UI
   * @param message the forbidden error message
   * @example
   * .throwForbiddenError('My forbidden error message');
   */
  throwForbiddenError(message: string): never {
    throw new ForbiddenError(message);
  }

  /**
   * Stop hooks execution and send error to the UI
   * @param message the error message
   * @example
   * .throwError('My error message');
   */
  throwError(message: string): never {
    throw new UnprocessableError(message);
  }
}
