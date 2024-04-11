import { readFile } from 'fs/promises';
import mongoose, { Schema } from 'mongoose';
import path from 'path';

import { Introspection, buildDisconnectedMongooseInstance, buildMongooseInstance } from '../src';
import { ConnectionError, SshConnectError } from '../src/errors';

describe('Datasource Mongo', () => {
  describe('buildDisconnectedMongooseInstance', () => {
    it('should build a mongoose instance with the given introspection', () => {
      const introspection: Introspection = {
        source: '@forestadmin/datasource-mongo',
        version: 3,
        models: [
          {
            name: 'comments',
            analysis: {
              type: 'object',
              object: {
                _id: { type: 'ObjectId', nullable: false },
                date: { type: 'Date', nullable: false },
                name: { type: 'string', nullable: false },
                text: { type: 'string', nullable: false },
                email: { type: 'string', nullable: false },
                movie_id: { type: 'ObjectId', nullable: false },
              },
              nullable: false,
            },
          },
          {
            name: 'movies',
            analysis: {
              type: 'object',
              object: {
                _id: { type: 'ObjectId', nullable: false },
                title: { type: 'string', nullable: false },
                tomatoes: {
                  type: 'object',
                  object: {
                    critic: {
                      type: 'object',
                      object: {
                        meter: { type: 'number', nullable: false },
                        rating: { type: 'number', nullable: false },
                        numReviews: { type: 'number', nullable: false },
                      },
                      nullable: false,
                    },
                  },
                  nullable: false,
                },
                lastupdated: { type: 'string', nullable: false },
              },
              nullable: false,
            },
          },
        ],
      };

      const connection = buildDisconnectedMongooseInstance(introspection);

      expect(connection).toBeDefined();

      expect(connection.models.comments).toBeDefined();
      expect(connection.models.movies).toBeDefined();
    });
  });

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

    describe('with a direct connection', () => {
      it('should connect to the database and define the models', async () => {
        const connection = await buildMongooseInstance({
          uri: 'mongodb://forest:secret@127.0.0.1:27017/movies?authSource=admin',
        });

        try {
          expect(connection).toBeDefined();
          expect(connection.modelNames()).toEqual(['movies']);
        } finally {
          await connection.close(true);
        }
      });
    });

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

        it('should throw an error with the righ url', async () => {
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
