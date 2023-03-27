import { BusinessError } from '../src/errors';

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
  });
});
