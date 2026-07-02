import { action, collection, column, polymorphic, relation } from './fixtures';
import ReadModel from '../../src/read-model/read-model';

describe('ReadModel', () => {
  describe('collection allow-list', () => {
    it('should report a schema collection as allowed and an absent one as not allowed', () => {
      const model = new ReadModel([collection('users', [column('id')])]);

      expect(model.isCollectionAllowed('users')).toBe(true);
      expect(model.isCollectionAllowed('secrets')).toBe(false);
    });
  });

  describe('relation allow-list and targets', () => {
    it('should allow-list a relation and resolve its foreign collection from the reference', () => {
      const model = new ReadModel([
        collection('users', [column('id'), relation('company', 'BelongsTo', 'companies.id')]),
      ]);

      expect(model.isRelationAllowed('users', 'company')).toBe(true);
      expect(model.getRelationTarget('users', 'company')).toEqual({
        type: 'BelongsTo',
        polymorphic: false,
        target: 'companies',
      });
    });

    it('should not allow-list a relation absent from the collection', () => {
      const model = new ReadModel([collection('users', [column('id')])]);

      expect(model.isRelationAllowed('users', 'company')).toBe(false);
      expect(model.getRelationTarget('users', 'company')).toBeUndefined();
    });

    it('should allow-list all four relationship types', () => {
      const model = new ReadModel([
        collection('users', [
          relation('company', 'BelongsTo', 'companies.id'),
          relation('profile', 'HasOne', 'profiles.userId'),
          relation('orders', 'HasMany', 'orders.userId'),
          relation('roles', 'BelongsToMany', 'roles.id'),
        ]),
      ]);

      expect(model.getRelationTarget('users', 'company')?.type).toBe('BelongsTo');
      expect(model.getRelationTarget('users', 'profile')?.type).toBe('HasOne');
      expect(model.getRelationTarget('users', 'orders')?.type).toBe('HasMany');
      expect(model.getRelationTarget('users', 'roles')?.type).toBe('BelongsToMany');
    });

    it('should resolve a dotted foreign collection name (e.g. mongoose nested) as the target', () => {
      const model = new ReadModel([
        collection('users', [relation('address', 'HasOne', 'users.address.id')]),
      ]);

      expect(model.getRelationTarget('users', 'address')).toEqual({
        type: 'HasOne',
        polymorphic: false,
        target: 'users.address',
      });
    });

    it('should flag a polymorphic relation and store its target list', () => {
      const model = new ReadModel([
        collection('comments', [polymorphic('commentable', ['posts', 'videos'])]),
      ]);

      expect(model.getRelationTarget('comments', 'commentable')).toEqual({
        type: 'BelongsTo',
        polymorphic: true,
        targets: ['posts', 'videos'],
      });
    });
  });

  describe('collection-scoped keying', () => {
    it('should keep same-named relations on different collections distinct', () => {
      const model = new ReadModel([
        collection('a', [relation('owner', 'BelongsTo', 'people.id')]),
        collection('b', [relation('owner', 'BelongsTo', 'orgs.id')]),
      ]);

      expect(model.getRelationTarget('a', 'owner')).toMatchObject({ target: 'people' });
      expect(model.getRelationTarget('b', 'owner')).toMatchObject({ target: 'orgs' });
    });

    it('should keep same-named actions on different collections distinct', () => {
      const model = new ReadModel([
        collection('a', [column('id')], [action('ban', '/forest/a/actions/ban')]),
        collection('b', [column('id')], [action('ban', '/forest/b/actions/ban')]),
      ]);

      expect(model.getActionEndpoints().a.ban.endpoint).toBe('/forest/a/actions/ban');
      expect(model.getActionEndpoints().b.ban.endpoint).toBe('/forest/b/actions/ban');
    });
  });

  describe('action endpoint map and allow-list', () => {
    it('should map an action with an endpoint and allow-list it', () => {
      const model = new ReadModel([
        collection('users', [column('id')], [action('ban', '/forest/users/actions/ban')]),
      ]);

      expect(model.isActionAllowed('users', 'ban')).toBe(true);
      expect(model.getActionEndpoints().users.ban).toEqual({
        id: 'ban-id',
        name: 'ban',
        endpoint: '/forest/users/actions/ban',
        hooks: { load: false, change: [] },
        fields: [],
      });
    });

    it('should not expose an action that has no endpoint', () => {
      const model = new ReadModel([collection('users', [column('id')], [action('ban', '')])]);

      expect(model.isActionAllowed('users', 'ban')).toBe(false);
      expect(model.getActionEndpoints().users).toBeUndefined();
    });
  });
});
