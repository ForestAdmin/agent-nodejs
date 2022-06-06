import { Caller } from '../../interfaces/caller';
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
import CollectionDecorator from '../collection-decorator';
import Filter from '../../interfaces/query/filter/unpaginated';
import HookContext from './context/hook';
import Hooks from './hook';
import PaginatedFilter from '../../interfaces/query/filter/paginated';
import Projection from '../../interfaces/query/projection';

export default class CollectionHookDecorator extends CollectionDecorator {
  private hooks = {
    list: new Hooks<HookBeforeListContext, HookAfterListContext>(),
    create: new Hooks<HookBeforeCreateContext, HookAfterCreateContext>(),
    update: new Hooks<HookBeforeUpdateContext, HookAfterUpdateContext>(),
    delete: new Hooks<HookBeforeDeleteContext, HookAfterDeleteContext>(),
  };

  // private onExecuteActionHooks: {
  //   [actionName: string]: Hooks<HookBeforeActionExecuteContext, HookAfterActionExecuteContext>;
  // } = {};

  addHook<P extends HookPosition = HookPosition, T extends HookType = HookType>(
    position: P,
    type: T,
    handler: HookHandler<HooksContext[P][T]>,
  ): void {
    this.hooks[type as HookType].addHandler(position, handler as HookHandler<HookContext>);
  }

  // addOnExecuteActionHook(
  //   actionName: string,
  //   position: HookPosition,
  //   handler: HookHandler<HookBeforeActionExecuteContext | HookAfterActionExecuteContext>,
  // ) {
  //   if (!this.onExecuteActionHooks[actionName]) this.onExecuteActionHooks[actionName]
  // = new Hooks();

  //   this.onExecuteActionHooks[actionName].addHandler(position, handler);
  // }

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const beforeContext = new HookBeforeCreateContext(this.childCollection, caller, data);
    await this.hooks.create.executeBefore(beforeContext);

    const records = await this.childCollection.create(beforeContext.caller, beforeContext.data);

    const afterContext = new HookAfterCreateContext(this.childCollection, caller, data, records);
    await this.hooks.create.executeAfter(afterContext);

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
    await this.hooks.list.executeBefore(beforeContext);
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
    await this.hooks.list.executeAfter(afterContext);

    return records;
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    const beforeContext = new InternalHookBeforeUpdateContext(
      this.childCollection,
      caller,
      filter,
      patch,
    );
    await this.hooks.update.executeBefore(beforeContext);

    await this.childCollection.update(
      beforeContext.caller,
      beforeContext.getFilter(),
      beforeContext.patch,
    );

    const afterContext = new HookAfterUpdateContext(this.childCollection, caller, filter, patch);
    await this.hooks.update.executeAfter(afterContext);
  }

  override async delete(caller: Caller, filter: Filter): Promise<void> {
    const beforeContext = new InternalHookBeforeDeleteContext(this.childCollection, caller, filter);
    await this.hooks.delete.executeBefore(beforeContext);

    await this.childCollection.delete(beforeContext.caller, beforeContext.getFilter());

    const afterContext = new HookAfterDeleteContext(this.childCollection, caller, filter);
    await this.hooks.delete.executeAfter(afterContext);
  }

  // override async aggregate(
  //   caller: Caller,
  //   filter: Filter,
  //   aggregation: Aggregation,
  //   limit?: number,
  // ): Promise<AggregateResult[]> {
  //   await this.onAggregateHooks.executeBefore({ caller, filter, aggregation, limit });

  //   const aggregationResult = await this.childCollection.aggregate(
  //     caller,
  //     filter,
  //     aggregation,
  //     limit,
  //   );

  //   await this.onAggregateHooks.executeAfter({
  //     caller,
  //     filter,
  //     aggregation,
  //     limit,
  //     aggregationResult,
  //   });

  //   return aggregationResult;
  // }

  // override async execute(
  //   caller: Caller,
  //   name: string,
  //   data: RecordData,
  //   filter?: Filter,
  // ): Promise<ActionResult> {
  //   if (this.onExecuteActionHooks[name])
  //     await this.onExecuteActionHooks[name].executeBefore({ caller, name, data, filter });

  //   const actionResult = await this.childCollection.execute(caller, name, data, filter);

  //   if (this.onExecuteActionHooks[name])
  //     await this.onExecuteActionHooks[name].executeAfter({
  //       caller,
  //       name,
  //       data,
  //       filter,
  //       actionResult,
  //     });

  //   return actionResult;
  // }
}
