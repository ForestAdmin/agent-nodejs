import { Factory } from 'fishery';
import { FieldTypes, ManyToManySchema } from '../../../src/interfaces/schema';

export default Factory.define<ManyToManySchema>(() => ({
  type: FieldTypes.ManyToMany,
  originRelation: 'book',
  targetRelation: 'review',
  throughCollection: 'bookReviews',
  foreignCollection: 'review',
}));
