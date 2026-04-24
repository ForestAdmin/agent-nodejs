import type { ActivityLogPort, ActivityLogPortFactory } from '../ports/activity-log-port';
import type { Logger } from '../ports/logger-port';
import type { ActivityLogsServiceInterface } from '@forestadmin/forestadmin-client';

import ActivityLogDrainer from './activity-log-drainer';
import ForestadminClientActivityLogPort from './forestadmin-client-activity-log-port';

export default class ForestadminClientActivityLogPortFactory implements ActivityLogPortFactory {
  private readonly drainer = new ActivityLogDrainer();

  constructor(
    private readonly service: ActivityLogsServiceInterface,
    private readonly logger: Logger,
  ) {}

  forRun(forestServerToken: string): ActivityLogPort {
    return new ForestadminClientActivityLogPort(
      this.service,
      this.logger,
      forestServerToken,
      this.drainer,
    );
  }

  async drain(): Promise<void> {
    return this.drainer.drain();
  }
}
