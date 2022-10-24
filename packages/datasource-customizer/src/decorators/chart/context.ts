import {
  Caller,
  Collection,
  CompositeId,
  ConditionTreeFactory,
} from '@forestadmin/datasource-toolkit';
import { TCollectionName, TConditionTree, TFieldName, TRow, TSchema } from '../../templates';
import CollectionCustomizationContext from '../../context/collection-context';

export default class CollectionChartContext<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> extends CollectionCustomizationContext<S, N> {
  readonly compositeRecordId: CompositeId;

  get recordId(): string | number {
    if (this.compositeRecordId.length > 1) {
      throw new Error(`Collection is using a composite pk: use \`context.compositeRecordId\`.`);
    }

    return this.compositeRecordId[0];
  }

  constructor(collection: Collection, caller: Caller, recordId: CompositeId) {
    super(collection, caller);

    this.compositeRecordId = recordId;
  }

  async getRecord(fields: TFieldName<S, N>[]): Promise<TRow<S, N>> {
    const conditionTree = ConditionTreeFactory.matchIds(this.realCollection.schema, [
      this.compositeRecordId,
    ]) as unknown as TConditionTree<S, N>;

    const [record] = await this.collection.list({ conditionTree }, fields);

    return record;
  }
}
