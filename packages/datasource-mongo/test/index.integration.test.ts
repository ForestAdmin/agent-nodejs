import type { Introspection } from '../src';

import mongoose, { Schema } from 'mongoose';

import {
  buildDisconnectedMongooseInstance,
  buildMongooseInstance,
  createMongoDataSource,
} from '../src';

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

      await connection.dropDatabase();

      try {
        const movieSchema = new Schema({ title: String });
        const Movie = connection.model('Movies', movieSchema);
        await Movie.createCollection();
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
  });

  describe('createMongoDataSource', () => {
    describe('with a direct connection', () => {
      beforeEach(async () => {
        const connection = await mongoose.createConnection(
          'mongodb://forest:secret@127.0.0.1:27017/movies_datasource_test?authSource=admin',
        );

        await connection.dropDatabase();

        try {
          const movieSchema = new Schema({
            title: String,
            actors: [{ name: String }],
          });
          const Movie = connection.model('Super.Movies', movieSchema);
          await new Movie({
            title: 'Inception',
            actors: [
              {
                name: 'Leonardo DiCaprio',
              },
              {
                name: 'Elliot Page',
              },
              {
                name: 'Marion Cotillard',
              },
            ],
          }).save();
        } finally {
          await connection.close(true);
        }
      });

      afterEach(async () => {
        await mongoose.disconnect();
      });

      it('should work to connect to the DB with collection names using dots and flatten relationships', async () => {
        // Bug with collections having a dot in their name
        const factory = createMongoDataSource({
          uri: 'mongodb://forest:secret@127.0.0.1:27017/movies_datasource_test?authSource=admin',
          dataSource: {
            flattenMode: 'auto',
          },
        });

        const dataSource = await factory(jest.fn(), jest.fn());

        expect(dataSource.collections.map(c => c.name).sort()).toEqual([
          'super_movies',
          'super_movies_actors',
        ]);
      });
    });
  });
});
