import LiveCollection from '../src/collection';

describe('LiveDataSource > Collection', () => {
  it('should instanciate properly', () => {
    const liveDataSource = new LiveCollection('__name__', null, null, null);

    expect(liveDataSource).toBeDefined();
  });

  describe('getAction', () => {
    it.todo('TODO');
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
