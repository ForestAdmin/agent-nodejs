import type { OneToOneSchema } from '../../../src/interfaces/schema';

import { Factory } from 'fishery';

export default Factory.define<OneToOneSchema>(() => ({
  type: 'OneToOne',
  originKey: 'reviewId',
  originKeyTarget: 'id',
  foreignCollection: 'review',
}));
