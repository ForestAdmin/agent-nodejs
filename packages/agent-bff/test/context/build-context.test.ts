import schemaCoveringEveryContractShape from './fixtures';
import buildContext from '../../src/context/build-context';
import ReadModel from '../../src/read-model/read-model';

describe('buildContext', () => {
  const schema = schemaCoveringEveryContractShape();
  const readModel = new ReadModel(schema);

  function usersOf(context: ReturnType<typeof buildContext>) {
    return context.collections.find(collection => collection.name === 'users');
  }

  function fieldNamed(context: ReturnType<typeof buildContext>, name: string) {
    return usersOf(context)?.fields.find(entry => entry.field === name);
  }

  describe('when the schema carries every field shape', () => {
    it('should pass a primitive, an array and a composite type through untouched', () => {
      const context = buildContext(schema, readModel, 1);

      expect(fieldNamed(context, 'id')?.type).toBe('Uuid');
      expect(fieldNamed(context, 'tagsWithArrayType')?.type).toEqual(['String']);
      expect(fieldNamed(context, 'addressWithCompositeType')?.type).toEqual({
        fields: [{ field: 'city', type: 'String' }],
      });
    });

    it('should carry reference and inverseOf on a relation that has them', () => {
      const context = buildContext(schema, readModel, 1);

      expect(fieldNamed(context, 'ordersHasManyWithInverseOf')).toEqual({
        field: 'ordersHasManyWithInverseOf',
        type: 'String',
        reference: 'orders.customerId',
        inverseOf: 'customer',
      });
    });

    it('should omit inverseOf on a relation that lacks it', () => {
      const context = buildContext(schema, readModel, 1);
      const relation = fieldNamed(context, 'teamBelongsToWithoutInverseOf');

      expect(relation).toEqual({
        field: 'teamBelongsToWithoutInverseOf',
        type: 'String',
        reference: 'teams.id',
      });
      expect(relation).not.toHaveProperty('inverseOf');
    });

    it('should keep a polymorphic relation, which carries no reference', () => {
      const context = buildContext(schema, readModel, 1);

      expect(fieldNamed(context, 'ownerPolymorphic')).toEqual({
        field: 'ownerPolymorphic',
        type: 'String',
      });
    });

    it('should carry isRequired and isReadOnly only when true', () => {
      const context = buildContext(schema, readModel, 1);

      expect(fieldNamed(context, 'emailRequired')?.isRequired).toBe(true);
      expect(fieldNamed(context, 'lockedReadOnly')?.isReadOnly).toBe(true);
      expect(fieldNamed(context, 'id')).not.toHaveProperty('isRequired');
      expect(fieldNamed(context, 'id')).not.toHaveProperty('isReadOnly');
    });
  });

  describe('when the schema carries actions', () => {
    it('should expose single, bulk and global actions alike', () => {
      const context = buildContext(schema, readModel, 1);

      expect(usersOf(context)?.actions.map(entry => [entry.name, entry.type])).toEqual([
        ['Ban user', 'single'],
        ['Export all', 'global'],
        ['Archive', 'bulk'],
      ]);
    });

    it('should drop an action with no endpoint, matching the read-model allow-list', () => {
      const context = buildContext(schema, readModel, 1);

      expect(readModel.isActionAllowed('users', 'Endpointless action')).toBe(false);
      expect(usersOf(context)?.actions.map(entry => entry.name)).not.toContain(
        'Endpointless action',
      );
    });

    it('should keep a falsy default value and an empty enum list, which carry meaning', () => {
      const context = buildContext(schema, readModel, 1);
      const exportAction = usersOf(context)?.actions.find(entry => entry.name === 'Export all');

      expect(exportAction?.fields).toEqual([
        { field: 'includeArchived', type: 'Boolean', isRequired: false, defaultValue: false },
        { field: 'limit', type: 'Number', defaultValue: 0 },
        { field: 'since', type: 'Date', defaultValue: null },
        { field: 'format', type: 'Enum', enums: [] },
      ]);
    });

    it('should serialize an action field with its enums and default value', () => {
      const context = buildContext(schema, readModel, 1);
      const banAction = usersOf(context)?.actions.find(entry => entry.name === 'Ban user');

      expect(banAction?.fields).toEqual([
        {
          field: 'reason',
          type: 'Enum',
          isRequired: true,
          defaultValue: 'spam',
          enums: ['spam', 'abuse'],
        },
      ]);
    });
  });

  describe('when a collection is not in the read-model allow-list', () => {
    it('should omit it', () => {
      const restricted = new ReadModel(schema.filter(collection => collection.name === 'users'));

      const context = buildContext(schema, restricted, 1);

      expect(context.collections.map(collection => collection.name)).toEqual(['users']);
    });
  });

  describe('when a collection name is unusual', () => {
    it('should keep a dotted name and a name carrying a space verbatim', () => {
      const context = buildContext(schema, readModel, 1);

      expect(context.collections.map(collection => collection.name)).toEqual([
        'users',
        'User.address',
        'My Coll',
        'collectionWithoutFieldsNorActions',
      ]);
    });
  });

  describe('when a collection has neither fields nor actions', () => {
    it('should serialize it with empty lists rather than throwing', () => {
      const context = buildContext(schema, readModel, 1);

      expect(
        context.collections.find(
          collection => collection.name === 'collectionWithoutFieldsNorActions',
        ),
      ).toEqual({ name: 'collectionWithoutFieldsNorActions', fields: [], actions: [] });
    });
  });

  describe('meta', () => {
    it('should carry the schema revision it was built from', () => {
      expect(buildContext(schema, readModel, 7).meta).toEqual({ schemaRevision: 7 });
    });
  });

  describe('identity', () => {
    it('should expose collections and meta only, so no identity can ride along', () => {
      const context = buildContext(schema, readModel, 1);

      expect(Object.keys(context).sort()).toEqual(['collections', 'meta']);
      expect(Object.keys(context.meta)).toEqual(['schemaRevision']);
    });

    it('should expose only the agreed keys on a collection, a field and an action', () => {
      const context = buildContext(schema, readModel, 1);
      const users = usersOf(context);

      expect(Object.keys(users ?? {}).sort()).toEqual(['actions', 'fields', 'name']);
      expect(Object.keys(fieldNamed(context, 'ordersHasManyWithInverseOf') ?? {}).sort()).toEqual([
        'field',
        'inverseOf',
        'reference',
        'type',
      ]);
      expect(Object.keys(users?.actions[0] ?? {}).sort()).toEqual(['fields', 'id', 'name', 'type']);
    });
  });
});
