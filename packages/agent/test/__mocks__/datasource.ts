export const collectionSchema = {
  searchable: true,
  fields: {},
};

export const collectionGetAction = jest.fn();
export const collectionGetById = jest.fn();
export const collectionCreate = jest.fn();
export const collectionList = jest.fn();
export const collectionUpdate = jest.fn();
export const collectionDelete = jest.fn();
export const collectionAggregate = jest.fn();

export const CollectionMock = jest.fn().mockImplementation(() => ({
  dataSource: null,
  name: "book",
  schema: collectionSchema,
  getAction: collectionGetAction,
  getById: collectionGetById,
  create: collectionCreate,
  list: collectionList,
  update: collectionUpdate,
  delete: collectionDelete,
  aggregate: collectionAggregate,
}));

export default jest.fn().mockImplementation(() => ({
  collection: [new CollectionMock()],
  getCollection: jest.fn().mockReturnValue(new CollectionMock()),
}));
