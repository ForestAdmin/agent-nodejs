import { DataSource, FieldSchema, RecordData } from '@forestadmin/datasource-toolkit';

import BaseDummyCollection from './base';

export default class LibrariesCollection extends BaseDummyCollection {
  private static schema: Record<string, FieldSchema> = {
    id: {
      type: 'Column',
      columnType: 'Number',
      isPrimaryKey: true,
    },
    name: {
      type: 'Column',
      columnType: 'String',
    },
  };

  protected override records: RecordData[] = [
    {
      id: 1,
      name: 'Mollat',
    },
    {
      id: 2,
      name: 'Cultura',
    },
    {
      id: 3,
      name: 'Amazon',
    },
  ];

  constructor(datasource: DataSource) {
    super(datasource, 'libraries', LibrariesCollection.schema);
  }
}
