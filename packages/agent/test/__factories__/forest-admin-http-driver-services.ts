import type { ForestAdminHttpDriverServices } from '../../src/services';

import { Factory } from 'fishery';

import factoryAuthorization from './authorization/authorization';
import factorySegmentQueryHandler from './segment-query-handler';
import factorySerializer from './serializer';

export default Factory.define<ForestAdminHttpDriverServices>(() => ({
  serializer: factorySerializer.build(),
  authorization: factoryAuthorization.mockAllMethods().build(),
  segmentQueryHandler: factorySegmentQueryHandler.build(),
  chartHandler: {
    getChartWithContextInjected: jest.fn(),
    getQueryForChart: jest.fn(),
  },
}));
