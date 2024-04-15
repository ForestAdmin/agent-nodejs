import { readFile } from 'fs/promises';
import mongoose, { Schema } from 'mongoose';
import path from 'path';

import { buildMongooseInstance } from '../src';
import { ConnectionError, SshConnectError } from '../src/errors';

describe('Datasource Mongo', () => {
  describe('buildMongooseInstance', () => {
    beforeEach(async () => {
      const connection = await mongoose.createConnection(
        'mongodb://forest:secret@127.0.0.1:27017/movies?authSource=admin',
      );

      connection.dropDatabase();

      try {
        const movieSchema = new Schema({ title: String });
        const Movie = connection.model('Movies', movieSchema);
        await new Movie({ title: 'Inception' }).save();
      } finally {
        await connection.close(true);
      }
    });

    // the lib tunnel-ssh seems to have a bug with error management
    // If this test is executed before the others, it will throw an error
    describe('with a connection through SSH', () => {
      it('should connect to the database and define the models', async () => {
        const privateKey = await readFile(path.resolve(__dirname, 'ssh-config', 'id_rsa'));
        const connection = await buildMongooseInstance({
          uri: 'mongodb://forest:secret@forest_datasource_mongo_test:27017/movies?authSource=admin',
          connection: {
            ssh: {
              host: '127.0.0.1',
              port: 2224,
              username: 'forest',
              privateKey,
            },
          },
        });

        try {
          expect(connection).toBeDefined();
          expect(connection.modelNames()).toEqual(['movies']);
        } finally {
          await connection.close(true);
        }
      });

      describe('in case of error', () => {
        it('should throw an error when the ssh host is wrong', async () => {
          const privateKey = await readFile(path.resolve(__dirname, 'ssh-config', 'id_rsa'));

          await expect(
            buildMongooseInstance({
              uri: 'mongodb://forest:secret@forest_datasource_mongo_test:27017/movies?authSource=admin',
              connection: {
                ssh: {
                  host: 'wrong-host',
                  port: 2224,
                  username: 'forest',
                  privateKey,
                },
              },
            }),
          ).rejects.toThrow(SshConnectError);
        });

        it('should throw an error with the right url', async () => {
          const privateKey = await readFile(path.resolve(__dirname, 'ssh-config', 'id_rsa'));

          await expect(
            buildMongooseInstance({
              uri: 'mongodb://forest:secret@forest_datasource_mongo_test:27017/movies?authSource=admin',
              connection: {
                ssh: {
                  host: 'wrong-host',
                  port: 2224,
                  username: 'forest',
                  privateKey,
                },
              },
            }),
          ).rejects.toThrow(
            'Your ssh connection has encountered an error. Unable to connect to the given ssh uri: ssh://forest@wrong-host:2224',
          );
        });

        it('should throw an error when the password is wrong', async () => {
          const privateKey = await readFile(path.resolve(__dirname, 'ssh-config', 'id_rsa'));
          await expect(
            buildMongooseInstance({
              uri: 'mongodb://forest:FAKE@forest_datasource_mongo_test:27017/movies?authSource=admin',
              connection: {
                ssh: {
                  host: '127.0.0.1',
                  port: 2224,
                  username: 'forest',
                  privateKey,
                },
              },
            }),
          ).rejects.toThrow(
            new ConnectionError(
              'mongodb://forest:***@forest_datasource_mongo_test:27017/movies?authSource=admin',
              'Authentication failed.',
            ),
          );
        });

        it('should throw an error when the destination url is incorrect', async () => {
          const privateKey = await readFile(path.resolve(__dirname, 'ssh-config', 'id_rsa'));
          await expect(
            buildMongooseInstance({
              uri: 'mongodb://forest:secret@invalid_host:27017/movies?authSource=admin',
              connection: {
                ssh: {
                  host: '127.0.0.1',
                  port: 2224,
                  username: 'forest',
                  privateKey,
                },
                socketTimeoutMS: 10,
                connectTimeoutMS: 10,
                serverSelectionTimeoutMS: 10,
              },
            }),
          ).rejects.toThrow(
            new ConnectionError(
              'mongodb://forest:***@invalid_host:27017/movies?authSource=admin',
              'Server selection timed out after 10 ms',
            ),
          );
        });
      });
    });
  });
});
