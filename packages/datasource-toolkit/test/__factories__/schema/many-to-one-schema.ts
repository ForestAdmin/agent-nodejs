import { Factory } from 'fishery';
import { ManyToOneSchema } from '../../../src/interfaces/schema';

export default Factory.define<ManyToOneSchema>(() => ({
  type: 'ManyToOne',
  foreignKey: 'reviewId',
  foreignKeyTarget: 'id',
  foreignCollection: 'review',
}));
