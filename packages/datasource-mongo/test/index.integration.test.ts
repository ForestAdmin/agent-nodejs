import { Introspection, buildDisconnectedMongooseInstance } from '../src';

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

      const mongoose = buildDisconnectedMongooseInstance(introspection);

      expect(mongoose).toBeDefined();

      expect(mongoose.models.comments).toBeDefined();
      expect(mongoose.models.movies).toBeDefined();
    });
  });
});
