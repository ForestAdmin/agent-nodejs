import type { DataSource } from '@forestadmin/datasource-toolkit';

import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import flattenColumn from '../src/flatten-column';
import flattenJsonColumn from '../src/flatten-json-column';

jest.mock('../src/flatten-column');

const logger = () => {};

describe('flattenJsonColumn', () => {
  let dataSource: DataSource;
  let customizer: DataSourceCustomizer;

  beforeEach(() => {
    dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({
        name: 'book',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            author: factories.columnSchema.build({
              columnType: 'Json',
            }),
          },
        }),
      }),
    );

    customizer = new DataSourceCustomizer();
    customizer.addDataSource(async () => dataSource);
  });

  it('should forward work to the flattenColumn plugin', async () => {
    await expect(
      customizer
        .customizeCollection('book', book =>
          book.use(flattenJsonColumn, {
            columnName: 'author',
            columnType: {
              name: 'String',
              address: { city: 'String' },
            },
            readonly: true,
            keepOriginalColumn: true,
            level: 1,
          }),
        )
        .getDataSource(logger),
    ).resolves.toBeTruthy();

    expect(flattenColumn).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        columnName: 'author',
        columnType: {
          name: 'String',
          address: { city: 'String' },
        },
        readonly: true,
        level: 1,
      }),
      logger,
    );
  });

  describe('level detection', () => {
    it('should automatically determine level when not provided', async () => {
      await expect(
        customizer
          .customizeCollection('book', book =>
            book.use(flattenJsonColumn, {
              columnName: 'author',
              columnType: {
                name: 'String',
                address: { city: 'String' },
              },
            }),
          )
          .getDataSource(logger),
      ).resolves.toBeTruthy();

      expect(flattenColumn).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ level: 2 }),
        logger,
      );
    });
  });
});
