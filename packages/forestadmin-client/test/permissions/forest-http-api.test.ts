import ForestHttpApi from '../../src/permissions/forest-http-api';
import * as factories from '../__factories__';

describe('ForestHttpApi', () => {
  const options = factories.forestAdminClientOptions.build({
    forestServerUrl: 'https://api.url',
    envSecret: 'myEnvSecret',
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let superagentMock: any;

  beforeEach(() => {
    superagentMock = factories.superagent.mockAllMethods().build();
    jest.mock('superagent', () => superagentMock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Forest server error handling', () => {
    test('should throw an error if an error with no status code is dispatched', async () => {
      superagentMock.set.mockRejectedValue({ response: { status: 0 } });

      await expect(ForestHttpApi.getEnvironmentPermissions(options)).rejects.toThrow(
        /Are you online/,
      );
    });

    test('should throw an error if an error with 404 status is dispatched', async () => {
      superagentMock.set.mockRejectedValue({ response: { status: 404 } });

      await expect(ForestHttpApi.getEnvironmentPermissions(options)).rejects.toThrow(
        /failed to find the project related to the envSecret you configured/,
      );
    });

    test('should throw an error if an error with 503 status is dispatched', async () => {
      superagentMock.set.mockImplementation(() => {
        throw { name: 'error', message: 'request failed', response: { status: 503 } } as Error;
      });

      await expect(ForestHttpApi.getEnvironmentPermissions(options)).rejects.toThrow(
        /Forest is in maintenance for a few minutes/,
      );
    });

    test('should throw an error if a certificate error is dispatched', async () => {
      superagentMock.set.mockRejectedValue(new Error('invalid certificate'));

      await expect(ForestHttpApi.getEnvironmentPermissions(options)).rejects.toThrow(
        /ForestAdmin server TLS certificate cannot be verified/,
      );
    });

    test('should rethrow unexpected errors', async () => {
      superagentMock.set.mockRejectedValue(new Error('i am unexpected'));
      await expect(ForestHttpApi.getEnvironmentPermissions(options)).rejects.toThrow(
        'i am unexpected',
      );
    });
  });

  describe('getEnvironmentPermissions', () => {
    it('should return the result of a call to the API to get permissions', async () => {
      const body = { foo: 'bar' };
      superagentMock.set.mockResolvedValue({ body });

      const permissions = await ForestHttpApi.getEnvironmentPermissions(options);

      expect(permissions).toStrictEqual(body);
      expect(superagentMock.get).toHaveBeenCalledWith(
        'https://api.url/liana/v4/permissions/environment',
      );
      expect(superagentMock.set).toHaveBeenCalledWith('forest-secret-key', 'myEnvSecret');
    });

    it('should rethrow errors received from the backend', () => {
      const error = new Error('Unexpected error');

      superagentMock.set.mockRejectedValue(error);

      return expect(ForestHttpApi.getEnvironmentPermissions(options)).rejects.toThrow(error);
    });

    it('should handle special errors', () => {
      superagentMock.set.mockRejectedValue({ response: { status: 404 } });

      return expect(ForestHttpApi.getEnvironmentPermissions(options)).rejects.toThrow(
        /failed to find the project related to the envSecret you configured/,
      );
    });
  });

  describe('getRenderingPermissions', () => {
    it('should return the result of a call to the API to get permissions', async () => {
      const body = { foo: 'bar' };
      superagentMock.set.mockResolvedValue({ body });

      const permissions = await ForestHttpApi.getRenderingPermissions(42, options);

      expect(permissions).toStrictEqual(body);
      expect(superagentMock.get).toHaveBeenCalledWith(
        'https://api.url/liana/v4/permissions/renderings/42',
      );
      expect(superagentMock.set).toHaveBeenCalledWith('forest-secret-key', 'myEnvSecret');
    });

    it('should rethrow errors received from the backend', () => {
      const error = new Error('Unexpected error');

      superagentMock.set.mockRejectedValue(error);

      return expect(ForestHttpApi.getRenderingPermissions(42, options)).rejects.toThrow(error);
    });

    it('should handle special errors', () => {
      superagentMock.set.mockRejectedValue({ response: { status: 404 } });

      return expect(ForestHttpApi.getRenderingPermissions(42, options)).rejects.toThrow(
        /failed to find the project related to the envSecret you configured/,
      );
    });
  });

  describe('getUsers', () => {
    it('should return the result of a call to the API to get permissions', async () => {
      const body = { foo: 'bar' };
      superagentMock.set.mockResolvedValue({ body });

      const permissions = await ForestHttpApi.getUsers(options);

      expect(permissions).toStrictEqual(body);
      expect(superagentMock.get).toHaveBeenCalledWith('https://api.url/liana/v4/permissions/users');
      expect(superagentMock.set).toHaveBeenCalledWith('forest-secret-key', 'myEnvSecret');
    });

    it('should rethrow errors received from the backend', () => {
      const error = new Error('Unexpected error');

      superagentMock.set.mockRejectedValue(error);

      return expect(ForestHttpApi.getUsers(options)).rejects.toThrow(error);
    });

    it('should handle special errors', () => {
      superagentMock.set.mockRejectedValue({ response: { status: 404 } });

      return expect(ForestHttpApi.getUsers(options)).rejects.toThrow(
        /failed to find the project related to the envSecret you configured/,
      );
    });
  });
});
