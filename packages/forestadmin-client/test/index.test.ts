import createForestAdminClient from '../src';
import ForestAdminClient from '../src/forest-admin-client-with-cache';

describe('ForestAdminClient index', () => {
  describe('without specifying optional parameters', () => {
    it('should create a new client with the right dependencies', () => {
      const created = createForestAdminClient({
        envSecret: 'SECRET',
      });

      expect(created).toBeInstanceOf(ForestAdminClient);
    });
  });
});
