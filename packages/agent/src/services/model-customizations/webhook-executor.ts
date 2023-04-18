import { ActionContext, TSchema } from '@forestadmin/datasource-customizer';
import { ModelCustomization, WebhookActionConfiguration } from '@forestadmin/forestadmin-client';
import superagent from 'superagent';

function generateBody(
  action: ModelCustomization<WebhookActionConfiguration>,
  ids: (string | number)[],
) {
  switch (action.configuration.scope) {
    case 'global':
      return {
        action: {
          name: action.name,
          scope: action.configuration.scope,
        },
      };
    case 'bulk':
      return {
        action: {
          name: action.name,
          scope: action.configuration.scope,
        },
        records: ids.map(id => ({ id })),
      };
    case 'single':
      if (ids.length !== 1) {
        throw new Error('Single actions can only be used with one selected record');
      }

      return {
        action: {
          name: action.name,
          scope: action.configuration.scope,
        },
        record: {
          id: ids[0],
        },
      };
    default:
      throw new Error(`Unknown scope: ${action.configuration.scope}`);
  }
}

async function executeWebhook<S extends TSchema = TSchema>(
  action: ModelCustomization<WebhookActionConfiguration>,
  context: ActionContext<S, Extract<keyof S, string>>,
) {
  const ids = action.configuration.scope === 'global' ? [] : await context.getRecordIds();

  const body = generateBody(action, ids);

  await superagent.post(action.configuration.url).send(body);
}

export default function createWebhookExecutor<S extends TSchema = TSchema>(
  action: ModelCustomization<WebhookActionConfiguration>,
): (context: ActionContext<S>) => Promise<void> {
  return executeWebhook.bind(undefined, action);
}
