import { Factory } from 'fishery';

import SegmentQueryHandler from '../../src/services/segment-query-handler';

export default Factory.define<SegmentQueryHandler>(
  () => new SegmentQueryHandler({ buildContextVariables: jest.fn().mockResolvedValue({}) }),
);
