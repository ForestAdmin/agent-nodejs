import type { Caller } from '@forestadmin/datasource-toolkit';

import mongoose, { Schema } from 'mongoose';

import { createMongoDataSource } from '../src';

describe('create', () => {
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

  async function createDataSource() {
    const dataSourceFactory = createMongoDataSource({
      uri: 'mongodb://forest:secret@127.0.0.1:27017/movies?authSource=admin',
      dataSource: {},
    });

    return dataSourceFactory(jest.fn());
  }

  it('should allow to create a new movie', async () => {
    const dataSource = await createDataSource();
    const movies = dataSource.getCollection('movies');

    const created = await movies.create(null as unknown as Caller, [{ title: 'Interstellar' }]);

    expect(created).toEqual([{ _id: expect.any(String), title: 'Interstellar' }]);
  });
});
