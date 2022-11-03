import { DataSource, FieldSchema, RecordData } from '@forestadmin/datasource-toolkit';

import BaseDummyCollection from './base';

export default class PersonsCollection extends BaseDummyCollection {
  private static schema: Record<string, FieldSchema> = {
    id: {
      type: 'Column',
      columnType: 'Number',
      isPrimaryKey: true,
    },
    firstName: {
      type: 'Column',
      columnType: 'String',
    },
    lastName: {
      type: 'Column',
      columnType: 'String',
    },
  };

  protected override records: RecordData[] = [
    {
      id: 1,
      firstName: 'Edward O.',
      lastName: 'Thorp',
    },
    {
      id: 2,
      firstName: 'Isaac',
      lastName: 'Asimov',
    },
    {
      id: 3,
      firstName: 'Roberto',
      lastName: 'Saviano',
    },
    {
      id: 4,
      firstName: 'Stephen',
      lastName: 'King',
    },
  ];

  constructor(datasource: DataSource) {
    super(datasource, 'persons', PersonsCollection.schema);
  }
}
