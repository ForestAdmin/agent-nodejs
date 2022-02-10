import { Factory } from 'fishery';

import { FieldTypes, OneToManySchema } from '../../../src/interfaces/schema';

export default Factory.define<OneToManySchema>(() => ({
  type: FieldTypes.OneToMany,
  foreignKey: 'reviewId',
  foreignCollection: 'review',
}));
