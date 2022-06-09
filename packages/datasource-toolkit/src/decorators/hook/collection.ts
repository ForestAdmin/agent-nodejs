import { Caller } from '../../interfaces/caller';
import {
  HookAfterAggregateContext,
  HookBeforeAggregateContext,
  InternalHookBeforeAggregateContext,
} from './context/aggregate';
import { HookAfterCreateContext, HookBeforeCreateContext } from './context/create';
import {
  HookAfterDeleteContext,
  HookBeforeDeleteContext,
  InternalHookBeforeDeleteContext,
} from './context/delete';
import {
  HookAfterListContext,
  HookBeforeListContext,
  InternalHookBeforeListContext,
} from './context/list';
import {
  HookAfterUpdateContext,
  HookBeforeUpdateContext,
  InternalHookBeforeUpdateContext,
} from './context/update';
import { HookHandler, HookPosition, HookType, HooksContext } from './types';
import { RecordData } from '../../interfaces/record';
import Aggregation, { AggregateResult } from '../../interfaces/query/aggregation';
import CollectionDecorator from '../collection-decorator';
import Filter from '../../interfaces/query/filter/unpaginated';
import HookContext from './context/hook';
import Hooks from './hook';
import PaginatedFilter from '../../interfaces/query/filter/paginated';
import Projection from '../../interfaces/query/projection';

export default class CollectionHookDecorator extends CollectionDecorator {
  private hooks: { [type in HookType<'After'>]: Hooks<HookContext, HookContext> } = {
    List: new Hooks<HookBeforeListContext, HookAfterListContext>(),
    Create: new Hooks<HookBeforeCreateContext, HookAfterCreateContext>(),
    Update: new Hooks<HookBeforeUpdateContext, HookAfterUpdateContext>(),
    Delete: new Hooks<HookBeforeDeleteContext, HookAfterDeleteContext>(),
    Aggregate: new Hooks<HookBeforeAggregateContext, HookAfterAggregateContext>(),
  };

  addHook<P extends HookPosition = HookPosition, T extends HookType = HookType>(
    position: P,
    type: T,
    handler: HookHandler<HooksContext[P][T]>,
  ): void {
    this.hooks[type as HookType].addHandler(position, handler as HookHandler<HookContext>);
  }

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const beforeContext = new HookBeforeCreateContext(this.childCollection, caller, data);
    await this.hooks.Create.executeBefore(beforeContext);

    const records = await this.childCollection.create(beforeContext.caller, beforeContext.data);

    const afterContext = new HookAfterCreateContext(this.childCollection, caller, data, records);
    await this.hooks.Create.executeAfter(afterContext);

    return records;
  }

  override async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const beforeContext = new InternalHookBeforeListContext(
      this.childCollection,
      caller,
      filter,
      projection,
    );
    await this.hooks.List.executeBefore(beforeContext);
    const records = await this.childCollection.list(
      beforeContext.caller,
      beforeContext.getFilter(),
      beforeContext.getProjection(),
    );

    const afterContext = new HookAfterListContext(
      this.childCollection,
      caller,
      filter,
      projection,
      records,
    );
    await this.hooks.List.executeAfter(afterContext);

    return records;
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    const beforeContext = new InternalHookBeforeUpdateContext(
      this.childCollection,
      caller,
      filter,
      patch,
    );
    await this.hooks.Update.executeBefore(beforeContext);

    await this.childCollection.update(
      beforeContext.caller,
      beforeContext.getFilter(),
      beforeContext.patch,
    );

    const afterContext = new HookAfterUpdateContext(this.childCollection, caller, filter, patch);
    await this.hooks.Update.executeAfter(afterContext);
  }

  override async delete(caller: Caller, filter: Filter): Promise<void> {
    const beforeContext = new InternalHookBeforeDeleteContext(this.childCollection, caller, filter);
    await this.hooks.Delete.executeBefore(beforeContext);

    await this.childCollection.delete(beforeContext.caller, beforeContext.getFilter());

    const afterContext = new HookAfterDeleteContext(this.childCollection, caller, filter);
    await this.hooks.Delete.executeAfter(afterContext);
  }

  override async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const beforeContext = new InternalHookBeforeAggregateContext(
      this.childCollection,
      caller,
      filter,
      aggregation,
      limit,
    );
    await this.hooks.Aggregate.executeBefore(beforeContext);

    const aggregationResult = await this.childCollection.aggregate(
      beforeContext.caller,
      beforeContext.getFilter(),
      beforeContext.getAggregation(),
      beforeContext.limit,
    );

    const afterContext = new HookAfterAggregateContext(
      this.childCollection,
      caller,
      filter,
      aggregation,
      aggregationResult,
      limit,
    );
    await this.hooks.Aggregate.executeAfter(afterContext);

    return aggregationResult;
  }
}
