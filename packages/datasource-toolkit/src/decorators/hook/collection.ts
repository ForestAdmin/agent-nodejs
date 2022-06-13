import { Caller } from '../../interfaces/caller';
import { HookAfterListContext, HookBeforeListContext } from './context/list';
import { HookHandler, HookPosition, HookType, HooksContext } from './types';
import { RecordData } from '../../interfaces/record';
import CollectionDecorator from '../collection-decorator';
import FilterFactory from '../../interfaces/query/filter/factory';
import HookContext from './context/hook';
import Hooks from './hook';
import PaginatedFilter from '../../interfaces/query/filter/paginated';
import Projection from '../../interfaces/query/projection';
import ProjectionFactory from '../../interfaces/query/projection/factory';

export default class CollectionHookDecorator extends CollectionDecorator {
  private hooks = {
    list: new Hooks<HookBeforeListContext, HookAfterListContext>(),
  };

  // private onExecuteActionHooks: {
  //   [actionName: string]: Hooks<HookBeforeActionExecuteContext, HookAfterActionExecuteContext>;
  // } = {};

  addHook(position: HookPosition, type: HookType, handler: HookHandler<HookContext>): void {
    this.hooks[type].addHandler(
      position,
      handler as HookHandler<HooksContext[typeof position][typeof type]>,
    );
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

  // override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
  //   const newContext = await this.onCreateHooks.executeBefore({ caller, data });

  //   const records = await this.childCollection.create(newContext.caller, newContext.data);

  //   await this.onCreateHooks.executeAfter({ caller, data, records });

  //   return records;
  // }

  override async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const beforeContext = new HookBeforeListContext(
      this.childCollection,
      caller,
      filter,
      projection,
    );
    const newContext = await this.hooks.list.executeBefore(beforeContext);

    const newFilter = FilterFactory.buildPaginatedFilterFromPlain(newContext.filter);
    const newProjection = ProjectionFactory.buildFromPlain(newContext.projection);
    const records = await this.childCollection.list(newContext.caller, newFilter, newProjection);

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

  // override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
  //   await this.onUpdateHooks.executeBefore({ caller, filter, patch });

  //   await this.childCollection.update(caller, filter, patch);

  //   await this.onUpdateHooks.executeAfter({ caller, filter, patch });
  // }

  // override async delete(caller: Caller, filter: Filter): Promise<void> {
  //   await this.onDeleteHooks.executeBefore({ caller, filter });

  //   await this.childCollection.delete(caller, filter);

  //   await this.onDeleteHooks.executeAfter({ caller, filter });
  // }

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
