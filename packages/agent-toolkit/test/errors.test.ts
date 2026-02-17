/* eslint-disable max-classes-per-file */
import {
  BadRequestError,
  BusinessError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  UnprocessableError,
  ValidationError,
} from '../src/errors';

describe('errors', () => {
  describe('BusinessError', () => {
    describe('name', () => {
      it('should have a name', () => {
        const error = new BusinessError('test');
        expect(error.name).toEqual('BusinessError');
      });

      it('should name the error after its constructor name', () => {
        class CustomError extends BusinessError {}
        const error = new CustomError('test');
        expect(error.name).toEqual('CustomError');
      });

      it('should use the name when it is given', () => {
        const error = new BusinessError('test', {}, 'MyName');
        expect(error.name).toEqual('MyName');
      });
    });

    describe('message', () => {
      it('should have a message', () => {
        const error = new BusinessError('test');
        expect(error.message).toEqual('test');
      });
    });

    describe('data', () => {
      it('should have data', () => {
        const error = new BusinessError('test', { foo: 'bar' });
        expect(error.data).toEqual({ foo: 'bar' });
      });

      it('should set the data to undefined by default', () => {
        const error = new BusinessError('test');
        expect(error.data).toBeUndefined();
      });
    });

    describe('isOfType', () => {
      it('should return true when the error is of the given type', () => {
        const error = new BusinessError('test');
        expect(BusinessError.isOfType(error, BusinessError)).toBeTruthy();
      });

      it('should return false when the error is not of the given type', () => {
        const error = new Error('test');
        expect(BusinessError.isOfType(error, BusinessError)).toBeFalsy();
      });
    });
  });

  describe('baseBusinessErrorName', () => {
    it.each([
      { ErrorClass: ValidationError, errorName: 'ValidationError' },
      { ErrorClass: BadRequestError, errorName: 'BadRequestError' },
      { ErrorClass: UnprocessableError, errorName: 'UnprocessableError' },
      { ErrorClass: ForbiddenError, errorName: 'ForbiddenError' },
      { ErrorClass: NotFoundError, errorName: 'NotFoundError' },
      { ErrorClass: UnauthorizedError, errorName: 'UnauthorizedError' },
      { ErrorClass: TooManyRequestsError, errorName: 'TooManyRequestsError' },
    ])('$errorName should have the correct baseBusinessErrorName', ({ ErrorClass, errorName }) => {
      const error = new ErrorClass('test');
      expect(error.baseBusinessErrorName).toEqual(errorName);
      expect(error.isBusinessError).toBe(true);
    });
  });
});
