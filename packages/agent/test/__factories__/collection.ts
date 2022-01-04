import { Factory } from 'fishery';
import { Collection } from '@forestadmin/datasource-toolkit';
import collectionSchema from './schema/collection-schema';

export default Factory.define<Collection>(() => ({
  dataSource: null,
  name: 'a collection',
  schema: collectionSchema.build(),
  getAction: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  list: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  aggregate: jest.fn(),
}));
