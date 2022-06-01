import { DecoratorError, ForbidenDecoratorError } from '../../errors';
import CollectionCustomizationContext from '../../context/collection-context';

export default class HookFlow<C> {
  private context: C;

  constructor(context: C) {
    this.context = context;
  }

  continue(context?: Partial<Omit<C, keyof CollectionCustomizationContext>>): C {
    if (context !== undefined) {
      this.context = {
        ...this.context,
        ...context,
      };
    }

    return this.context;
  }

  forbidden(errorMessage: string) {
    throw new ForbidenDecoratorError(errorMessage);
  }

  error(errorMessage: string) {
    throw new DecoratorError(errorMessage);
  }
}
