import { Factory } from 'fishery';
import { CollectionSchema } from '@forestadmin/datasource-toolkit';

export default Factory.define<CollectionSchema>(() => ({
  actions: [],
  fields: {},
  searchable: true,
  segments: [],
}));
