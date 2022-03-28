import { Factory } from 'fishery';
import { FieldTypes, ManyToManySchema } from '../../../src/interfaces/schema';

export default Factory.define<ManyToManySchema>(() => ({
  type: FieldTypes.ManyToMany,
  foreignCollection: 'review',
  throughCollection: 'bookReviews',
  foreignKey: 'reviewId',
  foreignKeyTarget: 'id',
  foreignRelation: 'myLibrary',
  originKey: 'bookId',
  originKeyTarget: 'id',
}));
