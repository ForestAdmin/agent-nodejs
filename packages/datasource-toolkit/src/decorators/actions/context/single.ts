import { Collection } from '../../../interfaces/collection';
import { CompositeId, RecordData } from '../../../interfaces/record';
import ActionContext from './base';
import Filter from '../../../interfaces/query/filter/unpaginated';
import Projection from '../../../interfaces/query/projection';
import RecordUtils from '../../../utils/record';

export default class ActionContextSingle extends ActionContext {
  readonly filter: Filter;
  private dependencies: Projection;
  private recordId: CompositeId;
  private record: RecordData;

  constructor(
    collection: Collection,
    formValues: RecordData,
    used: Set<string>,
    dependencies: Projection,
    filter: Filter,
  ) {
    super(collection, formValues, used);

    this.dependencies = dependencies;
    this.filter = filter;
  }

  async getRecordId(): Promise<CompositeId> {
    if (!this.recordId) {
      const [record] = await this.collection.list(
        this.filter,
        new Projection().withPks(this.collection),
      );

      this.recordId = RecordUtils.getPrimaryKey(this.collection.schema, record);
    }

    return this.recordId;
  }

  async getRecord(): Promise<RecordData> {
    if (!this.record) {
      const [record] = await this.collection.list(
        this.filter,
        this.dependencies.withPks(this.collection),
      );

      this.recordId = RecordUtils.getPrimaryKey(this.collection.schema, record);
      [this.record] = this.dependencies.apply([record]);
    }

    return this.record;
  }
}
