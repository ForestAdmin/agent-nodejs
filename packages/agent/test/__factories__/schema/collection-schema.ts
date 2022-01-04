import { CollectionSchema } from '@forestadmin/datasource-toolkit';
import { Factory } from 'fishery';

export default Factory.define<CollectionSchema>(() => ({
  actions: [],
  fields: {},
  searchable: true,
  segments: [],
}));
