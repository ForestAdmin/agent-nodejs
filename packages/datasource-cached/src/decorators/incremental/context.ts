/* eslint-disable max-classes-per-file */
import {
  CollectionCustomizationContext,
  HookAfterCreateContext,
  HookAfterDeleteContext,
  HookAfterUpdateContext,
  HookBeforeAggregateContext,
  HookBeforeListContext,
} from '@forestadmin/datasource-customizer';

export class SyncContext extends CollectionCustomizationContext {}

export class IncrementalSyncContext extends SyncContext {
  state: unknown;
}

export class BeforeListIncrementalSyncContext
  extends HookBeforeListContext
  implements IncrementalSyncContext
{
  state: unknown;
}

export class BeforeAggregateIncrementalSyncContext
  extends HookBeforeAggregateContext
  implements IncrementalSyncContext
{
  state: unknown;
}

export class AfterCreateIncrementalSyncContext
  extends HookAfterCreateContext
  implements IncrementalSyncContext
{
  state: unknown;
}

export class AfterUpdateIncrementalSyncContext
  extends HookAfterUpdateContext
  implements IncrementalSyncContext
{
  state: unknown;
}

export class AfterDeleteIncrementalSyncContext
  extends HookAfterDeleteContext
  implements IncrementalSyncContext
{
  state: unknown;
}
