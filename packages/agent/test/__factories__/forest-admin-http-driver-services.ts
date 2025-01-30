import { Factory } from 'fishery';

import factoryAuthorization from './authorization/authorization';
import factorySegmentQueryHandler from './segment-query-handler';
import factorySerializer from './serializer';
import { ForestAdminHttpDriverServices } from '../../src/services';

export default Factory.define<ForestAdminHttpDriverServices>(() => ({
  serializer: factorySerializer.build(),
  authorization: factoryAuthorization.mockAllMethods().build(),
  segmentQueryHandler: factorySegmentQueryHandler.build(),
  chartHandler: {
    getChartWithContextInjected: jest.fn(),
    getQueryForChart: jest.fn(),
  },
}));
