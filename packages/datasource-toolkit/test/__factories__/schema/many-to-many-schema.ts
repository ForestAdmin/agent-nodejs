import { Factory } from 'fishery';
import { FieldTypes, ManyToManySchema } from '../../../dist/interfaces/schema';

export default Factory.define<ManyToManySchema>(() => ({
  type: FieldTypes.ManyToMany,
  otherField: 'bookId',
  throughCollection: 'bookReviews',
  foreignKey: 'reviewId',
  foreignCollection: 'review',
}));
