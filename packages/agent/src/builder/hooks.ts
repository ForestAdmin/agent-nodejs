import {
  HookCollectionDecorator,
  HookHandler,
  HooksContext,
  TCollectionName,
  TSchema,
} from '@forestadmin/datasource-toolkit';

import CollectionBuilder from './collection';

export default class HooksBuilder<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> {
  private readonly hookCollectionDecorator: HookCollectionDecorator;
  private collectionBuilder: CollectionBuilder<S, N>;

  constructor(
    collectionBuilder: CollectionBuilder<S, N>,
    hookCollectionDecorator: HookCollectionDecorator,
  ) {
    this.collectionBuilder = collectionBuilder;
    this.hookCollectionDecorator = hookCollectionDecorator;
  }

  onBeforeList(
    handler: HookHandler<HooksContext<S, N>['before']['list']>,
  ): CollectionBuilder<S, N> {
    this.hookCollectionDecorator.addHook(
      'before',
      'list',
      handler as unknown as HookHandler<HooksContext['before']['list']>,
    );

    return this.collectionBuilder;
  }

  // onBeforeCreate(handler: HookHandler<HookBeforeCreateContext>): CollectionBuilder<S, N> {
  //   this.hookCollectionDecorator.addHook('before', 'create', handler);

  //   return this.collectionBuilder;
  // }

  // onAfterCreate(handler: HookHandler<HookAfterCreateContext>): CollectionBuilder<S, N> {
  //   this.hookCollectionDecorator.addHook('after', 'create', handler);

  //   return this.collectionBuilder;
  // }

  // onBeforeList(
  //   handler: HookHandler<HooksContext<S, N>['before']['list'], S, N>,
  // ): CollectionBuilder<S, N> {
  //   this.hookCollectionDecorator.addHook('before', 'list', handler);

  //   return this.collectionBuilder;
  // }

  // onAfterList(
  //   handler: HookHandler<HooksContext<S, N>['after']['list'], S, N>,
  // ): CollectionBuilder<S, N> {
  //   this.hookCollectionDecorator.addHook('after', 'list', handler);

  //   return this.collectionBuilder;
  // }

  // onBeforeUpdate(handler: HookHandler<HookBeforeUpdateContext>): CollectionBuilder<S, N> {
  //   this.hookCollectionDecorator.addHook('before', 'update', handler);

  //   return this.collectionBuilder;
  // }

  // onAfterUpdate(handler: HookHandler<HookAfterUpdateContext>): CollectionBuilder<S, N> {
  //   this.hookCollectionDecorator.addHook('after', 'update', handler);

  //   return this.collectionBuilder;
  // }

  // onBeforeDelete(handler: HookHandler<HookBeforeDeleteContext>): CollectionBuilder<S, N> {
  //   this.hookCollectionDecorator.addHook('before', 'delete', handler);

  //   return this.collectionBuilder;
  // }

  // onAfterDelete(handler: HookHandler<HookAfterDeleteContext>): CollectionBuilder<S, N> {
  //   this.hookCollectionDecorator.addHook('after', 'delete', handler);

  //   return this.collectionBuilder;
  // }

  // onBeforeAggregate(handler: HookHandler<HookBeforeAggregateContext>): CollectionBuilder<S, N> {
  //   this.hookCollectionDecorator.addHook('before', 'aggregate', handler);

  //   return this.collectionBuilder;
  // }

  // onAfterAggregate(handler: HookHandler<HookAfterAggregateContext>): CollectionBuilder<S, N> {
  //   this.hookCollectionDecorator.addHook('after', 'aggregate', handler);

  //   return this.collectionBuilder;
  // }

  // onBeforeExecute(
  //   actionName: string,
  //   handler: HookHandler<HookBeforeActionExecuteContext>,
  // ): CollectionBuilder<S, N> {
  //   this.hookCollectionDecorator.addOnExecuteActionHook(actionName, 'before', handler);

  //   return this.collectionBuilder;
  // }

  // onAfterExecute(
  //   actionName: string,
  //   handler: HookHandler<HookAfterActionExecuteContext>,
  // ): CollectionBuilder<S, N> {
  //   this.hookCollectionDecorator.addOnExecuteActionHook(actionName, 'after', handler);

  //   return this.collectionBuilder;
  // }
}
