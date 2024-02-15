import * as axios from 'axios';

import { BusinessError } from '../../src/errors';
import HttpServer from '../../src/services/http-server';

jest.mock('axios');
jest.mocked(axios.AxiosError).mockRestore();
const httpServer = new HttpServer('server-url', 'sk', 'bearerToken');

describe('http-server', () => {
  describe('getIntrospection', () => {
    describe('if no error occurs', () => {
      it('should get the introspection from axios call', async () => {
        const data = Symbol('data');
        jest.mocked(axios.default).mockResolvedValue({ data });
        expect(await httpServer.getIntrospection()).toBe(data);
        expect(axios).toHaveBeenCalled();
        expect(axios).toHaveBeenCalledWith({
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
});
