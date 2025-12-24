import type { TSchema } from '../templates';
import type { Caller, DataSource } from '@forestadmin/datasource-toolkit';

import {
  ForbiddenError,
  UnprocessableError,
  ValidationError,
} from '@forestadmin/datasource-toolkit';

import RelaxedDataSource from './relaxed-wrappers/datasource';

export default class AgentCustomizationContext<S extends TSchema = TSchema> {
  private realDataSource: DataSource;
  private _caller: Caller;

  get dataSource(): RelaxedDataSource<S> {
    return new RelaxedDataSource<S>(this.realDataSource, this._caller);
  }

  constructor(dataSource: DataSource, caller: Caller) {
    this.realDataSource = dataSource;
    this._caller = caller;
  }

  get caller() {
    return Object.freeze(this._caller);
  }

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
