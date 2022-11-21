import { Factory } from 'fishery';

import { OneToOneSchema } from '../../../src/interfaces/schema';

export default Factory.define<OneToOneSchema>(() => ({
  type: 'OneToOne',
  originKey: 'reviewId',
  originKeyTarget: 'id',
  foreignCollection: 'review',
}));
