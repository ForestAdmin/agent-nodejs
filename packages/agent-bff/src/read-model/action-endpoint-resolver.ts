import type ReadModel from './read-model';
import type { Metrics } from '../ports/metrics-port';
import type { ActionEndpointsByCollection } from '@forestadmin/agent-client';

export const ACTION_ENDPOINT_MISS = 'action_endpoint_miss';
export const ACTION_ENDPOINT_ERROR = 'action_endpoint_error';

export type ActionEndpointInfo = ActionEndpointsByCollection[string][string];

export type ReadModelProvider = () => Promise<ReadModel>;

export interface ResolveActionContext {
  rendering: string | number;
}

/**
 * Resolves an action to its endpoint against the current read-model. Never throws: an absent
 * mapping emits the miss counter, a failure to obtain the read-model emits the error counter.
 * Both counters carry `rendering`, `collection`, and `action` tags. In normal flow the action
 * allow-list already excludes endpoint-less actions, so the miss path is a defensive guard.
 */
export default class ActionEndpointResolver {
  constructor(
    private readonly getReadModel: ReadModelProvider,
    private readonly metrics: Metrics,
  ) {}

  async resolve(
    collection: string,
    action: string,
    { rendering }: ResolveActionContext,
  ): Promise<ActionEndpointInfo | undefined> {
    const tags = { rendering, collection, action };

    let readModel: ReadModel;

    try {
      readModel = await this.getReadModel();
    } catch {
      this.metrics.increment(ACTION_ENDPOINT_ERROR, tags);

      return undefined;
    }

    const info = readModel.getActionEndpoints()[collection]?.[action];

    if (!info) {
      this.metrics.increment(ACTION_ENDPOINT_MISS, tags);

      return undefined;
    }

    return info;
  }
}
