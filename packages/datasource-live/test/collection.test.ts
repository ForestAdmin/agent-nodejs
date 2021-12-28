import { CollectionSchema } from '@forestadmin/datasource-toolkit';
import LiveCollection from '../src/collection';

const liveCollectionSchema: CollectionSchema = {
  actions: [{ name: '__action__', scope: 'single' }],
  fields: {},
  searchable: true,
  segments: [],
};
const instanciateCollection = () =>
  // eslint-disable-next-line implicit-arrow-linebreak
  new LiveCollection('__name__', null, liveCollectionSchema, null);

describe('LiveDataSource > Collection', () => {
  it('should instanciate properly', () => {
    const liveCollection = instanciateCollection();

    expect(liveCollection).toBeDefined();
  });

  describe('getAction', () => {
    it('should return a known action', () => {
      const liveCollection = instanciateCollection();

      // TODO: Match actual action when defined.
      expect(liveCollection.getAction('__action__')).toBeNull();
    });

    it('should thrown with an unknown action name', () => {
      const liveCollection = instanciateCollection();

      expect(() => liveCollection.getAction('__no_such_action__')).toThrow(
        'Action "__no_such_action__" not found.',
      );
    });
  });

  describe('getById', () => {
    it.todo('TODO');
  });

  describe('create', () => {
    it.todo('TODO');
  });

  describe('list', () => {
    it.todo('TODO');
  });

  describe('update', () => {
    it.todo('TODO');
  });

  describe('delete', () => {
    it.todo('TODO');
  });

  describe('aggregate', () => {
    it.todo('TODO');
  });
});
