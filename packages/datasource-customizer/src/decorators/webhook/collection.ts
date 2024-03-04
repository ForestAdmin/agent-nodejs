import { Caller, CollectionDecorator, Filter } from '@forestadmin/datasource-toolkit';

import WebhookApprovalRequestedContext from './context/approval-requested';
import { WebhookHandler, WebhookType, WebhooksContext } from './types';
import Webhooks from './webhook';

export default class CollectionWebhookDecorator extends CollectionDecorator {
  private allWebhooks = {
    ApprovalRequested: new Webhooks<WebhookApprovalRequestedContext>(),
    Approval: new Webhooks<WebhookApprovalRequestedContext>(),
  };

  addWebhook<T extends WebhookType = WebhookType>(
    name: string,
    type: T,
    handler: WebhookHandler<WebhooksContext[T]>,
  ): void {
    this.allWebhooks[type].addHandler(name, handler);
  }

  override async executeWebhook(
    caller: Caller,
    filter: Filter,
    name: string,
    type: WebhookType,
    flexContext: any
  ): Promise<void> {
    const webhooks = this.allWebhooks[type];

    if (!webhooks || !webhooks.hasHandlerFor(name)) return this.childCollection.executeWebhook(caller, filter, name, type, flexContext);

    await webhooks.executeWebhook(name, this.getContext(caller, filter, type, flexContext));
  }

  private getContext(
    caller: Caller,
    filter: Filter,
    type: WebhookType,
    flexContext: any // We won't check it here we trust executeWebhook initiator
  ) {
    return new {
      ApprovalRequested: WebhookApprovalRequestedContext,
      Approval: WebhookApprovalRequestedContext,
    }[type](this, caller, filter, flexContext);
  }
}
