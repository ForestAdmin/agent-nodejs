import { Factory } from 'fishery';
import { OneToManySchema } from '../../../src/interfaces/schema';

export default Factory.define<OneToManySchema>(() => ({
  type: 'OneToMany',
  originKey: 'reviewId',
  originKeyTarget: 'id',
  foreignCollection: 'review',
}));
