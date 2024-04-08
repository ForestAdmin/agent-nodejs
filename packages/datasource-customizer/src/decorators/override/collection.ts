import { Caller, CollectionDecorator, Filter, RecordData } from '@forestadmin/datasource-toolkit';

import {
  CreateOverrideCustomizationContext,
  DeleteOverrideCustomizationContext,
  UpdateOverrideCustomizationContext,
} from './context';
import { CreateOverrideHandler, DeleteOverrideHandler, UpdateOverrideHandler } from './types';

export default class OverrideCollectionDecorator extends CollectionDecorator {
  private createHandler: CreateOverrideHandler;
  private updateHandler: UpdateOverrideHandler;
  private deleteHandler: DeleteOverrideHandler;

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    if (this.createHandler) {
      const context = new CreateOverrideCustomizationContext(this.childCollection, caller, data);

      return this.createHandler(context);
    }

    return super.create(caller, data);
  }

  addCreateHandler(handler: CreateOverrideHandler) {
    this.createHandler = handler;
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    if (this.updateHandler) {
      const context = new UpdateOverrideCustomizationContext(
        this.childCollection,
        caller,
        filter,
        patch,
      );

      return this.updateHandler(context);
    }

    return super.update(caller, filter, patch);
  }

  addUpdateHandler(handler: UpdateOverrideHandler) {
    this.updateHandler = handler;
  }

  override async delete(caller: Caller, filter: Filter): Promise<void> {
    if (this.deleteHandler) {
      const context = new DeleteOverrideCustomizationContext(this.childCollection, caller, filter);

      return this.deleteHandler(context);
    }

    return super.delete(caller, filter);
  }

  addDeleteHandler(handler: UpdateOverrideHandler) {
    this.deleteHandler = handler;
  }
}
