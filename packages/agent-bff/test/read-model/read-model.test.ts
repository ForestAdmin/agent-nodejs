import type { ForestSchemaAction, ForestSchemaCollection } from '@forestadmin/forestadmin-client';

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

    it('should ignore a relation field that has neither a reference nor polymorphic targets', () => {
      const model = new ReadModel([
        collection('users', [{ ...column('mystery'), relationship: 'HasMany' }]),
      ]);

      expect(model.isRelationAllowed('users', 'mystery')).toBe(false);
      expect(model.getRelationTarget('users', 'mystery')).toBeUndefined();
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

    it('should return frozen relation targets that a consumer cannot mutate', () => {
      const model = new ReadModel([
        collection('comments', [polymorphic('commentable', ['posts'])]),
      ]);

      const target = model.getRelationTarget('comments', 'commentable');

      expect(Object.isFrozen(target)).toBe(true);
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

    it('should defensively copy action fields and hooks so a consumer cannot mutate the cache', () => {
      const original = action('ban', '/forest/users/actions/ban');
      original.fields = [{ field: 'reason', type: 'String' }];
      original.hooks = { load: true, change: ['dep'] };
      const model = new ReadModel([collection('users', [], [original])]);

      const stored = model.getActionEndpoints().users.ban;

      expect(stored.fields).toEqual([{ field: 'reason', type: 'String' }]);
      expect(stored.fields).not.toBe(original.fields);
      expect(stored.fields[0]).not.toBe(original.fields[0]);
      expect(stored.hooks.change).not.toBe(original.hooks.change);
    });

    it('should handle a collection with no actions key', () => {
      const model = new ReadModel([{ name: 'users', fields: [] }]);

      expect(model.isActionAllowed('users', 'ban')).toBe(false);
    });

    it('should return a frozen action-endpoint map that a consumer cannot mutate', () => {
      const model = new ReadModel([
        collection('users', [], [action('ban', '/forest/users/actions/ban')]),
      ]);

      const endpoints = model.getActionEndpoints();

      expect(Object.isFrozen(endpoints)).toBe(true);
      expect(Object.isFrozen(endpoints.users.ban)).toBe(true);
      expect(() => {
        endpoints.users.ban.endpoint = 'mutated';
      }).toThrow();
    });

    it('should default hooks and fields when a malformed action omits them', () => {
      const malformed = {
        id: 'ban-id',
        name: 'ban',
        type: 'single',
        endpoint: '/forest/users/actions/ban',
        download: false,
      } as unknown as ForestSchemaAction;
      const model = new ReadModel([collection('users', [], [malformed])]);

      const stored = model.getActionEndpoints().users.ban;

      expect(stored.hooks).toEqual({ load: false, change: [] });
      expect(stored.fields).toEqual([]);
    });

    it('should not throw on a malformed collection with no fields key', () => {
      const model = new ReadModel([{ name: 'weird' } as unknown as ForestSchemaCollection]);

      expect(model.isCollectionAllowed('weird')).toBe(true);
      expect(model.isRelationAllowed('weird', 'x')).toBe(false);
    });
  });

  describe('queries on an unknown collection', () => {
    it('should report everything as not allowed', () => {
      const model = new ReadModel([collection('users', [])]);

      expect(model.isRelationAllowed('ghost', 'x')).toBe(false);
      expect(model.getRelationTarget('ghost', 'x')).toBeUndefined();
      expect(model.isActionAllowed('ghost', 'x')).toBe(false);
    });
  });
});
