import {
  DataSource,
  FieldSchema,
  FieldTypes,
  PrimitiveTypes,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import BaseDummyCollection from './base';

export default class PersonsCollection extends BaseDummyCollection {
  private static schema: Record<string, FieldSchema> = {
    id: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.Number,
      isPrimaryKey: true,
    },
    firstName: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.String,
    },
    lastName: {
      type: FieldTypes.Column,
      columnType: PrimitiveTypes.String,
    },
  };

  private static records: RecordData[] = [
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
    super(datasource, 'persons', PersonsCollection.schema, PersonsCollection.records);
  }
}
