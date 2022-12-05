import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';
import { DataSource, Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import flattenColumn from '../src/flatten-column';

const logger = () => {};

const caller = factories.caller.build();
const filter = factories.filter.build();

describe('flattenColumn', () => {
  let dataSource: DataSource;
  let customizer: DataSourceCustomizer;

  beforeEach(() => {
    dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({
        name: 'book',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            title: factories.columnSchema.build(),
            author: factories.columnSchema.build({
              columnType: {
                name: 'String',
                address: { city: 'String' },
              },
            }),
          },
        }),
      }),
    );

    customizer = new DataSourceCustomizer();
    customizer.addDataSource(async () => dataSource);
  });

  it('should throw when used on the datasource', async () => {
    const options = { columnName: 'myColumn' };

    await expect(customizer.use(flattenColumn, options).getDataSource(logger)).rejects.toThrow(
      'This plugin can only be called when customizing collections.',
    );
  });

  it('should throw when option is not provided', async () => {
    await expect(
      customizer.customizeCollection('book', book => book.use(flattenColumn)).getDataSource(logger),
    ).rejects.toThrow('options.columnName is required.');
  });

  it('should throw when column name is missing', async () => {
    const options = {} as { columnName: string };

    await expect(
      customizer
        .customizeCollection('book', book => book.use(flattenColumn, options))
        .getDataSource(logger),
    ).rejects.toThrow('options.columnName is required.');
  });

  describe('when flattening a single level', () => {
    let decorated: DataSource;

    beforeEach(async () => {
      const options = { columnName: 'author' };
      decorated = await customizer
        .customizeCollection('book', book => book.use(flattenColumn, options))
        .getDataSource(logger);
    });

    it('should update the schema', async () => {
      const { fields } = decorated.getCollection('book').schema;
      expect(fields['author@@@name']).toMatchObject({ columnType: 'String' });
      expect(fields['author@@@address']).toMatchObject({
        columnType: { city: 'String' },
      });
    });

    it('should work when listing data the flattened field is null', async () => {
      const baseList = dataSource.getCollection('book').list as jest.Mock;
      baseList.mockResolvedValue([{ id: '1', title: 'The Lord of the Rings', author: null }]);

      const projection = new Projection('id', 'title', 'author@@@name', 'author@@@address');
      const records = await decorated.getCollection('book').list(caller, filter, projection);

      expect(records).toEqual([
        {
          id: '1',
          title: 'The Lord of the Rings',
          'author@@@name': null,
          'author@@@address': null,
        },
      ]);
    });

    it('should work when listing data if everything is set', async () => {
      const baseList = dataSource.getCollection('book').list as jest.Mock;
      baseList.mockResolvedValue([
        {
          id: '1',
          title: 'The Lord of the Rings',
          author: {
            name: 'J.R.R. Tolkien',
            address: { city: 'New York' },
          },
        },
      ]);

      const projection = new Projection('id', 'title', 'author@@@name', 'author@@@address');
      const records = await decorated.getCollection('book').list(caller, filter, projection);

      expect(records).toEqual([
        {
          id: '1',
          title: 'The Lord of the Rings',
          'author@@@name': 'J.R.R. Tolkien',
          'author@@@address': { city: 'New York' },
        },
      ]);
    });
  });

  describe('when flattening recursively', () => {
    let decoratedDataSource: DataSource;

    beforeEach(async () => {
      const options = { columnName: 'author', level: 2 };
      decoratedDataSource = await customizer
        .customizeCollection('book', book => book.use(flattenColumn, options))
        .getDataSource(logger);
    });

    it('should update the schema', async () => {
      const { fields } = decoratedDataSource.getCollection('book').schema;
      expect(fields['author@@@name']).toMatchObject({ columnType: 'String' });
      expect(fields['author@@@name']).toMatchObject({ columnType: 'String' });
      expect(fields['author@@@address@@@city']).toMatchObject({ columnType: 'String' });
    });
  });
});
