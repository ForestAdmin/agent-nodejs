import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import {
  ForbiddenError,
  UnprocessableError,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import HookContext from '../../../../src/decorators/hook/context/hook';

class FakeHookContext extends HookContext {
  constructor() {
    super(factories.collection.build(), factories.caller.build());
  }
}

describe('Hook > Context', () => {
  test('throwError should throw UnprocessableError', () => {
    const hookContext = new FakeHookContext();
    const errorMessage = 'unprocessable error';
    expect(() => hookContext.throwError(errorMessage)).toThrow(UnprocessableError);
    expect(() => hookContext.throwError(errorMessage)).toThrow(errorMessage);
  });

  test('throwForbiddenError should throw ForbidenError', () => {
    const hookContext = new FakeHookContext();
    const errorMessage = 'forbidden error';
    expect(() => hookContext.throwForbiddenError(errorMessage)).toThrow(ForbiddenError);
    expect(() => hookContext.throwForbiddenError(errorMessage)).toThrow(errorMessage);
  });

  test('throwValidationError should throw ValidationError', () => {
    const hookContext = new FakeHookContext();
    const errorMessage = 'validation error';
    expect(() => hookContext.throwValidationError(errorMessage)).toThrow(ValidationError);
    expect(() => hookContext.throwValidationError(errorMessage)).toThrow(errorMessage);
  });
});
