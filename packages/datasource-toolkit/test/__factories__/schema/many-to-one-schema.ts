import type { ManyToOneSchema } from '../../../src/interfaces/schema';

import { Factory } from 'fishery';

export default Factory.define<ManyToOneSchema>(() => ({
  type: 'ManyToOne',
  foreignKey: 'reviewId',
  foreignKeyTarget: 'id',
  foreignCollection: 'review',
}));
