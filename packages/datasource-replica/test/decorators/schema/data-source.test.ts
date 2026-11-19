import type { ResolvedOptions } from '../../../src/types';

import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import SchemaDataSourceDecorator from '../../../src/decorators/schema/data-source';

const options = { flattenSchema: [] } as unknown as ResolvedOptions;

describe('SchemaDataSourceDecorator', () => {
  it('reports no database, whatever the cached datasource holds', () => {
    const decorator = new SchemaDataSourceDecorator(
      factories.dataSource.build({
        schema: { charts: [], databases: [{ type: 'sqlite', name: 'cache' }] },
      }),
      options,
    );

    expect(decorator.schema).toStrictEqual({
      charts: [],
      databases: [],
    });
  });

  it('keeps the charts of the cached datasource', () => {
    const decorator = new SchemaDataSourceDecorator(
      factories.dataSource.build({ schema: { charts: ['aChart'] } }),
      options,
    );

    expect(decorator.schema.charts).toStrictEqual(['aChart']);
  });
});
