import type { OneToManySchema } from '../../../src/interfaces/schema';

import { Factory } from 'fishery';

export default Factory.define<OneToManySchema>(() => ({
  type: 'OneToMany',
  originKey: 'reviewId',
  originKeyTarget: 'id',
  foreignCollection: 'review',
}));
