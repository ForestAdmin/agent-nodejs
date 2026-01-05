import type { ManyToManySchema } from '../../../src/interfaces/schema';

import { Factory } from 'fishery';

export default Factory.define<ManyToManySchema>(() => ({
  type: 'ManyToMany',
  foreignCollection: 'review',
  throughCollection: 'bookReviews',
  foreignKey: 'reviewId',
  foreignKeyTarget: 'id',
  originKey: 'bookId',
  originKeyTarget: 'id',
}));
