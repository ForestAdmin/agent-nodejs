import { Factory } from 'fishery';
import { FieldTypes, OneToManySchema } from '@forestadmin/datasource-toolkit';

export default Factory.define<OneToManySchema>(() => ({
  type: FieldTypes.OneToMany,
  foreignKey: 'reviewId',
  foreignCollection: 'review',
}));
