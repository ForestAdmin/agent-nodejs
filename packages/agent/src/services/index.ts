import { ChartHandlerInterface } from '@forestadmin/forestadmin-client';

import authorizationServiceFactory from './authorization';
import AuthorizationService from './authorization/authorization';
import SegmentQueryHandler from './segment-query-handler';
import Serializer from './serializer';
import { AgentOptionsWithDefaults } from '../types';

export type ForestAdminHttpDriverServices = {
  serializer: Serializer;
  authorization: AuthorizationService;
  chartHandler: ChartHandlerInterface;
  segmentQueryHandler: SegmentQueryHandler;
};

export default (options: AgentOptionsWithDefaults): ForestAdminHttpDriverServices => {
  return {
    authorization: authorizationServiceFactory(options),
    serializer: new Serializer(),
    chartHandler: options.forestAdminClient.chartHandler,
    segmentQueryHandler: new SegmentQueryHandler(
      options.forestAdminClient.contextVariablesInstantiator,
    ),
  };
};
