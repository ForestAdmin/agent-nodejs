import WebhookContext from './context';
import { WebhookHandler } from './types';

export default class Webhooks<HC extends WebhookContext> {

  private webhooks: Record<string, WebhookHandler<HC>> = {};

  async executeWebhook(name: string, context: HC): Promise<void> {
    await this.webhooks[name](context);
  }

  addHandler(name: string, handler: WebhookHandler<HC>) {
    if(this.webhooks[name])
      throw(`Already define ${name}`)

    this.webhooks[name] = handler as WebhookHandler<HC>;
  }

  hasHandlerFor(name: string) {
    return !!this.webhooks[name];
  }
}
