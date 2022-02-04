import { Collection } from '../../../interfaces/collection';
import Projection from '../../../interfaces/query/projection';
import { RecordData } from '../../../interfaces/record';
import { ColumnType } from '../../../interfaces/schema';
import RecordUtils from '../../../utils/record';
import { ComputedDefinition, ProxyDefinition } from '../types';

export default class ProxyField implements ComputedDefinition {
  readonly collection: Collection;
  readonly path: string;
  readonly columnType: ColumnType;

  get dependencies(): Projection {
    return new Projection(this.path);
  }

  constructor(collection: Collection, definition: ProxyDefinition & { type: ColumnType }) {
    this.collection = collection;
    this.path = definition.path;
    this.columnType = definition.type;
  }

  async getValues(records: RecordData[]): Promise<unknown[]> {
    return records.map(record => RecordUtils.getFieldValue(record, this.path));
  }
}
