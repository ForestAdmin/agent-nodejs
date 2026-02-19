/* eslint-disable max-classes-per-file */
import {
  BadRequestError,
  BusinessError,
  ForbiddenError,
  IntrospectionFormatError,
  NotFoundError,
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

  describe.each([
    { ErrorClass: ValidationError, expectedBase: 'ValidationError' },
    { ErrorClass: BadRequestError, expectedBase: 'BadRequestError' },
    { ErrorClass: UnprocessableError, expectedBase: 'UnprocessableError' },
    { ErrorClass: ForbiddenError, expectedBase: 'ForbiddenError' },
    { ErrorClass: NotFoundError, expectedBase: 'NotFoundError' },
  ])('$ErrorClass.name', ({ ErrorClass, expectedBase }) => {
    it(`should set baseBusinessErrorName to '${expectedBase}'`, () => {
      const error = new ErrorClass('test');
      expect(error.baseBusinessErrorName).toEqual(expectedBase);
    });
  });

  describe('IntrospectionFormatError', () => {
    describe('message', () => {
      it.each([['@forestadmin/datasource-mongo'], ['@forestadmin/datasource-sql']])(
        'for package %s it should display the correct message',
        source => {
          const error = new IntrospectionFormatError(
            source as '@forestadmin/datasource-sql' | '@forestadmin/datasource-mongo',
          );
          expect(error.message).toEqual(
            `This version of introspection is newer than this package version. Please update ${source}`,
          );
        },
      );
    });
  });
});
