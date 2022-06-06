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

  onBeforeCreate(
    handler: HookHandler<HooksContext<S, N>['before']['create']>,
  ): CollectionBuilder<S, N> {
    this.hookCollectionDecorator.addHook('before', 'create', handler);

    return this.collectionBuilder;
  }

  onAfterCreate(
    handler: HookHandler<HooksContext<S, N>['after']['create']>,
  ): CollectionBuilder<S, N> {
    this.hookCollectionDecorator.addHook('after', 'create', handler);

    return this.collectionBuilder;
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

  onAfterList(handler: HookHandler<HooksContext<S, N>['after']['list']>): CollectionBuilder<S, N> {
    this.hookCollectionDecorator.addHook(
      'after',
      'list',
      handler as unknown as HookHandler<HooksContext['after']['list']>,
    );

    return this.collectionBuilder;
  }

  onBeforeUpdate(
    handler: HookHandler<HooksContext<S, N>['before']['update']>,
  ): CollectionBuilder<S, N> {
    this.hookCollectionDecorator.addHook(
      'before',
      'update',
      handler as unknown as HookHandler<HooksContext['before']['update']>,
    );

    return this.collectionBuilder;
  }

  onAfterUpdate(
    handler: HookHandler<HooksContext<S, N>['after']['update']>,
  ): CollectionBuilder<S, N> {
    this.hookCollectionDecorator.addHook(
      'after',
      'update',
      handler as unknown as HookHandler<HooksContext['after']['update']>,
    );

    return this.collectionBuilder;
  }

  onBeforeDelete(
    handler: HookHandler<HooksContext<S, N>['before']['delete']>,
  ): CollectionBuilder<S, N> {
    this.hookCollectionDecorator.addHook(
      'before',
      'delete',
      handler as unknown as HookHandler<HooksContext['before']['delete']>,
    );

    return this.collectionBuilder;
  }

  onAfterDelete(
    handler: HookHandler<HooksContext<S, N>['after']['delete']>,
  ): CollectionBuilder<S, N> {
    this.hookCollectionDecorator.addHook(
      'after',
      'delete',
      handler as unknown as HookHandler<HooksContext['after']['delete']>,
    );

    return this.collectionBuilder;
  }

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
