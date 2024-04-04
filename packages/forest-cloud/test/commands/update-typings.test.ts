/* eslint-disable max-len */
import fs from 'fs/promises';
import path from 'path';

import CommandTester from './command-tester';
import { setupCommandArguments } from './utils';
import DistPathManager from '../../src/services/dist-path-manager';

describe('update-typings command', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as unknown as (_code?: number | undefined) => never);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('with a datasource sql introspection', () => {
    it('should update the typings from the introspection provided by the forest server', async () => {
      const getIntrospection = jest.fn().mockResolvedValue([
        {
          name: 'forestCollection',
          schema: 'public',
          columns: [
            {
              type: { type: 'scalar', subType: 'NUMBER' },
              autoIncrement: true,
              defaultValue: null,
              isLiteralDefaultValue: true,
              name: 'id',
              allowNull: false,
              primaryKey: true,
              constraints: [],
            },
          ],
          unique: [['id'], ['title']],
        },
      ]);
      const setup = setupCommandArguments({ getIntrospection });
      setup.distPathManager = new DistPathManager(path.join(__dirname, '/__data__'));
      await fs.rm(setup.bootstrapPathManager.typings, {
        force: true,
        recursive: true,
      });

      const cmd = new CommandTester(setup, ['update-typings']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.spinner.start('Updating typings'),
        cmd.spinner.succeed('Your typings have been updated'),
        cmd.spinner.stop(),
      ]);

      await expect(fs.access(setup.bootstrapPathManager.typings)).resolves.not.toThrow();

      const typings = await fs.readFile(setup.bootstrapPathManager.typings, 'utf-8');
      expect(typings).toContain("'HelloWorld': string");
    });
  });

  describe('with a datasource mongo introspection', () => {
    it('should update the typings from the introspection provided by the forest server', async () => {
      const getIntrospection = jest.fn().mockResolvedValue({
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
            name: 'embedded_movies',
            analysis: {
              type: 'object',
              object: {
                _id: { type: 'ObjectId', nullable: false },
                cast: {
                  type: 'array',
                  nullable: false,
                  arrayElement: { type: 'string', nullable: false },
                },
                imdb: {
                  type: 'object',
                  object: {
                    id: { type: 'number', nullable: false },
                    votes: { type: 'number', nullable: false },
                    rating: { type: 'number', nullable: false },
                  },
                  nullable: false,
                },
                plot: { type: 'string', nullable: false },
                type: { type: 'string', nullable: false },
                year: { type: 'number', nullable: false },
                rated: { type: 'string', nullable: false },
                title: { type: 'string', nullable: false },
                awards: {
                  type: 'object',
                  object: {
                    text: { type: 'string', nullable: false },
                    wins: { type: 'number', nullable: false },
                    nominations: { type: 'number', nullable: false },
                  },
                  nullable: false,
                },
                genres: {
                  type: 'array',
                  nullable: false,
                  arrayElement: { type: 'string', nullable: false },
                },
                poster: { type: 'string', nullable: false },
                runtime: { type: 'number', nullable: false },
                writers: {
                  type: 'array',
                  nullable: false,
                  arrayElement: { type: 'string', nullable: false },
                },
                fullplot: { type: 'string', nullable: false },
                released: { type: 'Date', nullable: false },
                tomatoes: {
                  type: 'object',
                  object: {
                    dvd: { type: 'Date', nullable: false },
                    fresh: { type: 'number', nullable: false },
                    critic: {
                      type: 'object',
                      object: {
                        meter: { type: 'number', nullable: false },
                        rating: { type: 'number', nullable: false },
                        numReviews: { type: 'number', nullable: false },
                      },
                      nullable: false,
                    },
                    rotten: { type: 'number', nullable: false },
                    viewer: {
                      type: 'object',
                      object: {
                        meter: { type: 'number', nullable: false },
                        rating: { type: 'number', nullable: false },
                        numReviews: { type: 'number', nullable: false },
                      },
                      nullable: false,
                    },
                    website: { type: 'string', nullable: false },
                    consensus: { type: 'string', nullable: false },
                    production: { type: 'string', nullable: false },
                    lastUpdated: { type: 'Date', nullable: false },
                  },
                  nullable: false,
                },
                countries: {
                  type: 'array',
                  nullable: false,
                  arrayElement: { type: 'string', nullable: false },
                },
                directors: {
                  type: 'array',
                  nullable: false,
                  arrayElement: { type: 'string', nullable: false },
                },
                languages: {
                  type: 'array',
                  nullable: false,
                  arrayElement: { type: 'string', nullable: false },
                },
                metacritic: { type: 'number', nullable: false },
                lastupdated: { type: 'string', nullable: false },
                plot_embedding: {
                  type: 'array',
                  nullable: false,
                  arrayElement: { type: 'number', nullable: false },
                },
                num_mflix_comments: { type: 'number', nullable: false },
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
                cast: {
                  type: 'array',
                  nullable: false,
                  arrayElement: { type: 'string', nullable: false },
                },
                imdb: {
                  type: 'object',
                  object: {
                    id: { type: 'number', nullable: false },
                    votes: { type: 'number', nullable: false },
                    rating: { type: 'number', nullable: false },
                  },
                  nullable: false,
                },
                plot: { type: 'string', nullable: false },
                type: { type: 'string', nullable: false },
                year: { type: 'number', nullable: false },
                rated: { type: 'string', nullable: false },
                title: { type: 'string', nullable: false },
                awards: {
                  type: 'object',
                  object: {
                    text: { type: 'string', nullable: false },
                    wins: { type: 'number', nullable: false },
                    nominations: { type: 'number', nullable: false },
                  },
                  nullable: false,
                },
                genres: {
                  type: 'array',
                  nullable: false,
                  arrayElement: { type: 'string', nullable: false },
                },
                poster: { type: 'string', nullable: false },
                runtime: { type: 'number', nullable: false },
                writers: {
                  type: 'array',
                  nullable: false,
                  arrayElement: { type: 'string', nullable: false },
                },
                fullplot: { type: 'string', nullable: false },
                released: { type: 'Date', nullable: false },
                tomatoes: {
                  type: 'object',
                  object: {
                    dvd: { type: 'Date', nullable: false },
                    fresh: { type: 'number', nullable: false },
                    critic: {
                      type: 'object',
                      object: {
                        meter: { type: 'number', nullable: false },
                        rating: { type: 'number', nullable: false },
                        numReviews: { type: 'number', nullable: false },
                      },
                      nullable: false,
                    },
                    rotten: { type: 'number', nullable: false },
                    viewer: {
                      type: 'object',
                      object: {
                        meter: { type: 'number', nullable: false },
                        rating: { type: 'number', nullable: false },
                        numReviews: { type: 'number', nullable: false },
                      },
                      nullable: false,
                    },
                    website: { type: 'string', nullable: false },
                    consensus: { type: 'string', nullable: false },
                    production: { type: 'string', nullable: false },
                    lastUpdated: { type: 'Date', nullable: false },
                  },
                  nullable: false,
                },
                countries: {
                  type: 'array',
                  nullable: false,
                  arrayElement: { type: 'string', nullable: false },
                },
                directors: {
                  type: 'array',
                  nullable: false,
                  arrayElement: { type: 'string', nullable: false },
                },
                languages: {
                  type: 'array',
                  nullable: false,
                  arrayElement: { type: 'string', nullable: false },
                },
                lastupdated: { type: 'string', nullable: false },
                num_mflix_comments: { type: 'number', nullable: false },
              },
              nullable: false,
            },
          },
          {
            name: 'forestCollection',
            analysis: {
              type: 'object',
              object: {
                id: { type: 'ObjectId', nullable: false },
                jwt: { type: 'string', nullable: false },
                user_id: { type: 'string', nullable: false },
              },
              nullable: false,
            },
          },
          {
            name: 'theaters',
            analysis: {
              type: 'object',
              object: {
                _id: { type: 'ObjectId', nullable: false },
                location: {
                  type: 'object',
                  object: {
                    geo: {
                      type: 'object',
                      object: {
                        type: { type: 'string', nullable: false },
                        coordinates: {
                          type: 'array',
                          nullable: false,
                          arrayElement: { type: 'number', nullable: false },
                        },
                      },
                      nullable: false,
                    },
                    address: {
                      type: 'object',
                      object: {
                        city: { type: 'string', nullable: false },
                        state: { type: 'string', nullable: false },
                        street1: { type: 'string', nullable: false },
                        street2: { type: 'string', nullable: false },
                        zipcode: { type: 'string', nullable: false },
                      },
                      nullable: false,
                    },
                  },
                  nullable: false,
                },
                theaterId: { type: 'number', nullable: false },
              },
              nullable: false,
            },
          },
          {
            name: 'users',
            analysis: {
              type: 'object',
              object: {
                _id: { type: 'ObjectId', nullable: false },
                name: { type: 'string', nullable: false },
                email: { type: 'string', nullable: false },
                password: { type: 'string', nullable: false },
                preferences: { type: 'Mixed', nullable: false },
              },
              nullable: false,
            },
          },
        ],
        source: '@forestadmin/datasource-mongo',
        version: 1,
      });
      const setup = setupCommandArguments({ getIntrospection });
      setup.distPathManager = new DistPathManager(path.join(__dirname, '/__data__'));
      await fs.rm(setup.bootstrapPathManager.typings, {
        force: true,
        recursive: true,
      });

      const cmd = new CommandTester(setup, ['update-typings']);
      await cmd.run();

      expect(cmd.outputs).toEqual([
        cmd.spinner.start('Updating typings'),
        cmd.spinner.succeed('Your typings have been updated'),
        cmd.spinner.stop(),
      ]);

      await expect(fs.access(setup.bootstrapPathManager.typings)).resolves.not.toThrow();

      const typings = await fs.readFile(setup.bootstrapPathManager.typings, 'utf-8');
      expect(typings).toContain("'HelloWorld': string");
      expect(typings).toContain("'tomatoes@@@critic@@@meter': number;");
    });
  });
});
