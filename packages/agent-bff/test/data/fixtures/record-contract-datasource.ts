import type { FieldSchema, RecordData } from '@forestadmin/datasource-toolkit';

import { BaseDataSource } from '@forestadmin/datasource-toolkit';

import InMemoryCollection from './in-memory-collection';

const PEOPLE: RecordData[] = [{ id: 8, first_name: 'Ada' }];

const NUMBER_PK: FieldSchema = { type: 'Column', columnType: 'Number', isPrimaryKey: true };

export default class RecordContractDataSource extends BaseDataSource {
  constructor() {
    super();

    this.addCollection(
      new InMemoryCollection(
        this,
        'people',
        {
          id: NUMBER_PK,
          first_name: { type: 'Column', columnType: 'String' },
        },
        PEOPLE,
      ),
    );
  }
}
