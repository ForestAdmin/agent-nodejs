import type { ConnectionParams } from '../../src';
import type { Connection } from 'mongoose';
import type { AddressInfo, Server } from 'net';
import type { Client } from 'ssh2';

import mongoose from 'mongoose';
import { createTunnel } from 'tunnel-ssh';

import createConnection from '../../src/connection/create-connection';
import { ConnectionError, SshConnectError } from '../../src/errors';

jest.mock('mongoose');
jest.mock('tunnel-ssh');

describe('createConnection', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  function setupMocks({ isSshActive = false } = {}) {
    const ssh = isSshActive
      ? {
          host: 'localhost',
        }
      : undefined;

    const server = {
      on: jest.fn(),
      close: jest.fn(),
      address: jest.fn().mockReturnValue({ port: 1234 } as AddressInfo),
    } as unknown as Server;
    const client = {
      destroy: jest.fn(),
    } as unknown as Client;

    jest.mocked(createTunnel).mockResolvedValue([server, client]);

    const awaitedConnection = {
      once: jest.fn(),
    };

    const connection = {
      asPromise: jest.fn().mockResolvedValue(awaitedConnection),
    } as unknown as Connection;

    jest.mocked(mongoose.createConnection).mockReturnValue(connection as unknown as Connection);

    return { ssh, server, client, connection, awaitedConnection };
  }

  describe('without ssh configuration', () => {
    it('should return the connection and wait for it to be established', async () => {
      const params: ConnectionParams = {
        uri: 'mongodb://localhost:27017',
        connection: {
          dbName: 'test',
        },
      };
      const { awaitedConnection, connection } = setupMocks();

      const createdConnection = await createConnection(params);

      expect(mongoose.createConnection).toHaveBeenCalledWith(params.uri, {
        dbName: 'test',
      });
      expect(createdConnection).toBe(awaitedConnection);
      expect(connection.asPromise).toHaveBeenCalled();
    });
  });

  describe('in case of an error with mongoDB', () => {
    describe.each([true, false])('when ssh is %s', isSshActive => {
      it('should throw a ConnectionError when the error is a MongooseError', async () => {
        const { ssh, connection } = setupMocks({ isSshActive });

        const params: ConnectionParams = {
          uri: 'mongodb://localhost:27017',
          connection: {
            dbName: 'test',
            ssh,
          },
        };

        const error = new mongoose.MongooseError('error message');
        jest.mocked(connection).asPromise.mockRejectedValue(error);

        await expect(createConnection(params)).rejects.toThrow(ConnectionError);
      });

      it('should throw a ConnectionError when the error is a MongoError', async () => {
        const { ssh, connection } = setupMocks({ isSshActive });

        const params: ConnectionParams = {
          uri: 'mongodb://localhost:27017',
          connection: {
            dbName: 'test',
            ssh,
          },
        };

        const error = new mongoose.mongo.MongoError('error message');
        jest.mocked(connection).asPromise.mockRejectedValue(error);

        await expect(createConnection(params)).rejects.toThrow(ConnectionError);
      });

      it('should rethrow other errors', async () => {
        const { ssh, connection } = setupMocks({ isSshActive });

        const params: ConnectionParams = {
          uri: 'mongodb://localhost:27017',
          connection: {
            dbName: 'test',
            ssh,
          },
        };

        const error = new Error('error message');
        jest.mocked(connection).asPromise.mockRejectedValue(error);

        await expect(createConnection(params)).rejects.toThrow(error);
      });

      it('should throw the error with the uri, without password', async () => {
        const { ssh, connection } = setupMocks({ isSshActive });

        const params: ConnectionParams = {
          uri: 'mongodb://user:password@hostname:27017',
          connection: {
            dbName: 'test',
            ssh,
          },
        };

        const error = new mongoose.MongooseError('error message');
        error.message = 'error message';
        jest.mocked(connection).asPromise.mockRejectedValue(error);

        await expect(createConnection(params)).rejects.toThrow(
          new ConnectionError('mongodb://user:***@hostname:27017', 'error message'),
        );
      });

      if (isSshActive) {
        it('should close the tunnel', async () => {
          const { ssh, server, client, connection } = setupMocks({ isSshActive });

          const params: ConnectionParams = {
            uri: 'mongodb://localhost:27017',
            connection: {
              dbName: 'test',
              ssh,
            },
          };

          const error = new mongoose.MongooseError('error message');
          jest.mocked(connection).asPromise.mockRejectedValue(error);

          await expect(createConnection(params)).rejects.toThrow(ConnectionError);

          expect(server.close).toHaveBeenCalled();
          expect(client.destroy).toHaveBeenCalled();
        });
      }
    });
  });

  describe('with an ssh configuration', () => {
    it('should create a SSH tunnel and connect through it', async () => {
      const params: ConnectionParams = {
        uri: 'mongodb://user:password@distant-hostname:27017',
        connection: {
          dbName: 'test',
          ssh: {
            host: 'localhost',
            username: 'user',
            port: 22,
          },
        },
      };

      const { awaitedConnection } = setupMocks({ isSshActive: true });

      const createdConnection = await createConnection(params);

      expect(createTunnel).toHaveBeenCalledWith(
        { autoClose: false, reconnectOnError: false },
        {},
        {
          host: 'localhost',
          username: 'user',
          port: 22,
        },
        {
          dstAddr: 'distant-hostname',
          dstPort: 27017,
        },
      );
      expect(mongoose.createConnection).toHaveBeenCalledWith(
        'mongodb://user:password@localhost:1234',
        {
          dbName: 'test',
          tlsAllowInvalidHostnames: true,
        },
      );
      expect(createdConnection).toBe(awaitedConnection);
    });

    it('should close the tunnel when the mongodb connection is closed', async () => {
      const params: ConnectionParams = {
        uri: 'mongodb://user:password@distant-hostname:27017',
        connection: {
          dbName: 'test',
          ssh: {
            host: 'localhost',
            username: 'user',
            port: 22,
          },
        },
      };

      const { server, client } = setupMocks({ isSshActive: true });

      const createdConnection = await createConnection(params);

      expect(createdConnection.once).toHaveBeenCalledOnceWith('close', expect.any(Function));
      const onClose = jest.mocked(createdConnection.once).mock.calls[0][1];
      onClose();

      expect(client.destroy).toHaveBeenCalled();
      expect(server.close).toHaveBeenCalled();
    });

    describe('in case of an error when creating the tunnel', () => {
      it('should throw a SshConnectError', async () => {
        const params: ConnectionParams = {
          uri: 'mongodb://user:password@distant-hostname:27017',
          connection: {
            dbName: 'test',
            ssh: {
              host: 'hostname',
              username: 'user',
              port: 22,
            },
          },
        };

        const error = new Error('error message');
        jest.mocked(createTunnel).mockRejectedValue(error);

        await expect(createConnection(params)).rejects.toThrow(
          new SshConnectError('error message', 'ssh://user@hostname:22'),
        );
      });
    });
  });
});
