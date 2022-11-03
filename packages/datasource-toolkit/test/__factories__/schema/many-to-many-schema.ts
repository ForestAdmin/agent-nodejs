import { Factory } from 'fishery';

import { ManyToManySchema } from '../../../src/interfaces/schema';

export default Factory.define<ManyToManySchema>(() => ({
  type: 'ManyToMany',
  foreignCollection: 'review',
  throughCollection: 'bookReviews',
  foreignKey: 'reviewId',
  foreignKeyTarget: 'id',
  originKey: 'bookId',
  originKeyTarget: 'id',
}));
