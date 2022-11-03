import { Factory } from 'fishery';

import { ForestAdminHttpDriverServices } from '../../src/services';
import factoryAuthorization from './authorization/authorization';
import factorySerializer from './serializer';

export default Factory.define<ForestAdminHttpDriverServices>(() => ({
  serializer: factorySerializer.build(),
  authorization: factoryAuthorization.mockAllMethods().build(),
  chartHandler: {
    getChartWithContextInjected: jest.fn(),
    getQueryForChart: jest.fn(),
  },
}));
