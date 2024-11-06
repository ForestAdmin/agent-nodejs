import * as axios from 'axios';
import fs from 'fs';

import { BusinessError, ValidationError } from '../../src/errors';
import HttpServer from '../../src/services/http-server';

jest.mock('axios');
jest.mock('fs');
jest.mocked(axios.AxiosError).mockRestore();
const httpServer = new HttpServer('server-url', 'sk', 'bearerToken');

describe('http-server', () => {
  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('if an error occurs', () => {
    describe('if it is not an axios error', () => {
      it('should throw a business error with details', async () => {
        jest.mocked(axios.default).mockRejectedValue(new Error('Some generic error'));
        await expect(httpServer.getDatasources()).rejects.toStrictEqual(
          new BusinessError(
            'Failed to retrieve database schema from Forest Admin server: Some generic error',
          ),
        );
      });

      it('should provide specific detail if message contains ERR_INVALID_CHAR', async () => {
        const error = new Error('Invalid character in header content ["Authorization"]');
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        error.code = 'ERR_INVALID_CHAR';
        jest.mocked(axios.default).mockRejectedValue(error);
        await expect(httpServer.getDatasources()).rejects.toStrictEqual(
          new BusinessError(
            `Invalid character in header content ["Authorization"]\nYour authentication token seems incorrect. You can try to login again by running 'npx @forestadmin/forest-cloud@latest login'`,
          ),
        );
      });
    });

    describe('if it an axios error', () => {
      it('should throw a business error with details and inner details', async () => {
        const error = new axios.AxiosError('Some axios error');
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        error.response = { data: { errors: [{ detail: 'some details', status: 123 }] } };
        jest.mocked(axios.default).mockRejectedValue(error);
        await expect(httpServer.getDatasources()).rejects.toStrictEqual(
          new BusinessError(
            'Failed to retrieve database schema from Forest Admin server: \n🚨 some details',
          ),
        );
      });

      describe('if it is a validation error', () => {
        it('should throw a validation error with details', async () => {
          const error = new axios.AxiosError('Some axios error');
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          error.response = {
            status: 400,
            data: { errors: [{ detail: 'some details' }] },
          };
          jest.mocked(axios.default).mockRejectedValue(error);
          await expect(httpServer.getDatasources()).rejects.toStrictEqual(
            new ValidationError('🚨 some details'),
          );
        });
      });

      describe('if it is an Unauthorized error', () => {
        it('should throw a Business error with details', async () => {
          const error = new axios.AxiosError('Some axios error');
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          error.response = {
            status: 401,
            data: { errors: [{ detail: 'some details' }] },
          };
          jest.mocked(axios.default).mockRejectedValue(error);
          await expect(httpServer.getDatasources()).rejects.toStrictEqual(
            new BusinessError(
              "Failed to retrieve database schema from Forest Admin server: \n🚨 some details\n You can try to login again by running 'npx @forestadmin/forest-cloud@latest login'",
            ),
          );
        });
      });

      describe('if it is a Forbidden error', () => {
        it('should throw a Business error with details', async () => {
          const error = new axios.AxiosError('Some axios error');
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          error.response = {
            status: 403,
            data: { errors: [{ detail: 'some details' }] },
          };
          jest.mocked(axios.default).mockRejectedValue(error);
          await expect(httpServer.getDatasources()).rejects.toStrictEqual(
            new BusinessError(
              "Failed to retrieve database schema from Forest Admin server: \n🚨 some details\n You can try to login again by running 'npx @forestadmin/forest-cloud@latest login'",
            ),
          );
        });
      });
    });
  });

  describe('getDatasources', () => {
    it('should get the introspection from axios call', async () => {
      const data = Symbol('data');
      jest.mocked(axios.default).mockResolvedValue({ data });
      expect(await httpServer.getDatasources()).toBe(data);
      expect(axios.default).toHaveBeenCalled();
      expect(axios.default).toHaveBeenCalledWith({
        headers: {
          Authorization: 'Bearer bearerToken',
          'Content-Type': 'application/json',
          'forest-secret-key': 'sk',
        },
        method: 'GET',
        url: 'server-url/api/full-hosted-agent/forest-cloud/datasources',
      });
    });
  });

  describe('postUploadRequest', () => {
    it('should call axios with the correct parameters', async () => {
      jest.mocked(axios.default).mockResolvedValue({});

      await httpServer.postUploadRequest(42);

      expect(axios.default).toHaveBeenCalled();
      expect(axios.default).toHaveBeenCalledWith({
        url: 'server-url/api/full-hosted-agent/upload-request',
        method: 'POST',
        headers: {
          'forest-secret-key': 'sk',
          Authorization: 'Bearer bearerToken',
          'Content-Type': 'application/json',
        },
        data: {
          contentLength: 42,
        },
      });
    });
  });

  describe('postPublish', () => {
    it('should call axios with the correct parameters', async () => {
      jest.mocked(axios.default).mockResolvedValue({});

      await httpServer.postPublish();

      expect(axios.default).toHaveBeenCalled();
      expect(axios.default).toHaveBeenCalledWith({
        url: 'server-url/api/full-hosted-agent/publish',
        method: 'POST',
        headers: {
          'forest-secret-key': 'sk',
          Authorization: 'Bearer bearerToken',
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('getLastPublishedCodeDetails', () => {
    it('should call axios with the correct parameters', async () => {
      jest.mocked(axios.default).mockResolvedValue({});

      await httpServer.getLastPublishedCodeDetails();

      expect(axios.default).toHaveBeenCalled();
      expect(axios.default).toHaveBeenCalledWith({
        url: 'server-url/api/full-hosted-agent/last-published-code-details',
        method: 'GET',
        headers: {
          'forest-secret-key': 'sk',
          Authorization: 'Bearer bearerToken',
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('downloadCloudCustomizerTemplate', () => {
    it('should call axios with the correct parameters', async () => {
      const responseSpy = { data: { pipe: jest.fn() } };
      jest.mocked(axios.default).mockResolvedValue(responseSpy);

      const stream = {
        on: (event: string, callback: () => unknown) => {
          if (event === 'finish') callback();
        },
      };

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      jest.spyOn(fs, 'createWriteStream').mockReturnValue(stream);

      await HttpServer.downloadCloudCustomizerTemplate('/target/directory/file.zip');

      expect(fs.createWriteStream).toHaveBeenCalled();
      expect(fs.createWriteStream).toHaveBeenCalledWith('/target/directory/file.zip');

      expect(responseSpy.data.pipe).toHaveBeenCalled();
      expect(responseSpy.data.pipe).toHaveBeenCalledWith(stream);

      expect(axios.default).toHaveBeenCalled();
      expect(axios.default).toHaveBeenCalledWith({
        url: 'https://github.com/ForestAdmin/cloud-customizer/archive/main.zip',
        method: 'get',
        responseType: 'stream',
      });
    });
  });

  describe('getLogs', () => {
    it('should call axios with the correct parameters', async () => {
      jest.mocked(axios.default).mockResolvedValue({ data: { logs: [] } });

      await httpServer.getLogs({ limit: 10, from: 'now-1h', to: 'now', orderByRecentFirst: true });

      expect(axios.default).toHaveBeenCalled();
      expect(axios.default).toHaveBeenCalledWith({
        url: 'server-url/api/full-hosted-agent/logs?limit=10&from=now-1h&to=now&order-by-recent-first=true',
        method: 'GET',
        headers: {
          'forest-secret-key': 'sk',
          Authorization: 'Bearer bearerToken',
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('getOrCreateNewDevelopmentEnvironment', () => {
    it('should POST to create a new environment', async () => {
      jest.mocked(axios.default).mockResolvedValue({
        data: {
          attributes: {
            secret_key: 'a784f885c9de4fdfc9cc953659bf6264e60a76e48e8c4af0956aef8f56c6650d',
          },
        },
      });

      await httpServer.getOrCreateNewDevelopmentEnvironment();

      expect(axios.default).toHaveBeenCalled();
      expect(axios.default).toHaveBeenCalledWith({
        url: 'server-url/api/full-hosted-agent/development-environment-for-user',
        method: 'POST',
        headers: {
          'forest-secret-key': 'sk',
          Authorization: 'Bearer bearerToken',
          'Content-Type': 'application/json',
        },
        data: { endpoint: 'http://localhost:3351' },
      });
    });

    describe('when there is an error on POST', () => {
      it('should GET the environment', async () => {
        jest.clearAllMocks();

        jest.mocked(axios.default).mockImplementation(async options => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          if (options.method === 'POST') {
            return Promise.reject(new Error('Environment already exists for user'));
          }

          return Promise.resolve({
            data: {
              data: {
                attributes: {
                  secret_key: 'a784f885c9de4fdfc9cc953659bf6264e60a76e48e8c4af0956aef8f56c6650d',
                },
              },
            },
          });
        });

        await httpServer.getOrCreateNewDevelopmentEnvironment();

        expect(axios.default).toHaveBeenCalledTimes(2);
        expect(axios.default).toHaveBeenLastCalledWith({
          url: 'server-url/api/full-hosted-agent/development-environment-for-user',
          method: 'GET',
          headers: {
            'forest-secret-key': 'sk',
            Authorization: 'Bearer bearerToken',
            'Content-Type': 'application/json',
          },
        });
      });
    });
  });
});
