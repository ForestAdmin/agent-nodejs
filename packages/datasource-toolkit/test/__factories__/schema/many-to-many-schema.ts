import { Factory } from 'fishery';
import { FieldTypes, ManyToManySchema } from '../../../src/interfaces/schema';

export default Factory.define<ManyToManySchema>(() => ({
  type: FieldTypes.ManyToMany,
  otherField: 'bookId',
  throughCollection: 'bookReviews',
  foreignKey: 'reviewId',
  originRelation: 'myBook',
  targetRelation: 'myLibrary',
  foreignCollection: 'review',
}));
