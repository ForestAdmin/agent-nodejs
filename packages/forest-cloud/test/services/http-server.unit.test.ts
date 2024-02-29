import * as axios from 'axios';
import fs from 'fs';

import { BusinessError } from '../../src/errors';
import HttpServer from '../../src/services/http-server';

jest.mock('axios');
jest.mock('fs');
jest.mocked(axios.AxiosError).mockRestore();
const httpServer = new HttpServer('server-url', 'sk', 'bearerToken');

describe('http-server', () => {
  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('getIntrospection', () => {
    describe('if no error occurs', () => {
      it('should get the introspection from axios call', async () => {
        const data = Symbol('data');
        jest.mocked(axios.default).mockResolvedValue({ data });
        expect(await httpServer.getIntrospection()).toBe(data);
        expect(axios.default).toHaveBeenCalled();
        expect(axios.default).toHaveBeenCalledWith({
          headers: {
            Authorization: 'Bearer bearerToken',
            'Content-Type': 'application/json',
            'forest-secret-key': 'sk',
          },
          method: 'GET',
          url: 'server-url/api/full-hosted-agent/introspection',
        });
      });
    });

    describe('if an error occurs', () => {
      describe('if it is not an axios error', () => {
        it('should throw a business error with details', async () => {
          jest.mocked(axios.default).mockRejectedValue(new Error('Some generic error'));
          await expect(httpServer.getIntrospection()).rejects.toStrictEqual(
            new BusinessError(
              'Failed to retrieve database schema from Forest Admin server: Some generic error',
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
          await expect(httpServer.getIntrospection()).rejects.toStrictEqual(
            new BusinessError(
              'Failed to retrieve database schema from Forest Admin server:  \n 🚨 some details',
            ),
          );
        });
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
      jest.mocked(axios.default).mockResolvedValue({});

      await httpServer.getLogs();

      expect(axios.default).toHaveBeenCalled();
      expect(axios.default).toHaveBeenCalledWith({
        url: 'server-url/api/full-hosted-agent/logs',
        method: 'GET',
        headers: {
          'forest-secret-key': 'sk',
          Authorization: 'Bearer bearerToken',
          'Content-Type': 'application/json',
        },
      });
    });

    it('should call axios with the correct parameters when tail is given', async () => {
      jest.mocked(axios.default).mockResolvedValue({});

      await httpServer.getLogs(10);

      expect(axios.default).toHaveBeenCalled();
      expect(axios.default).toHaveBeenCalledWith({
        url: 'server-url/api/full-hosted-agent/logs?limit=10',
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
