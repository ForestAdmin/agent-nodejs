import schemaCoveringEveryContractShape from './fixtures';
import buildContext from '../../src/context/build-context';
import { ContextResponseSchema } from '../../src/openapi/schemas';
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
      const context = buildContext(schema, readModel, { schemaRevision: 1 });

      expect(fieldNamed(context, 'id')?.type).toBe('Uuid');
      expect(fieldNamed(context, 'tagsWithArrayType')?.type).toEqual(['String']);
      expect(fieldNamed(context, 'addressWithCompositeType')?.type).toEqual({
        fields: [{ field: 'city', type: 'String' }],
      });
    });

    it('should carry reference and inverseOf on a relation that has them', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });

      expect(fieldNamed(context, 'ordersHasManyWithInverseOf')).toEqual({
        field: 'ordersHasManyWithInverseOf',
        type: 'String',
        relationship: 'HasMany',
        reference: 'orders.customerId',
        inverseOf: 'customer',
      });
    });

    it('should omit inverseOf on a relation that lacks it', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });
      const relation = fieldNamed(context, 'teamBelongsToWithoutInverseOf');

      expect(relation).toEqual({
        field: 'teamBelongsToWithoutInverseOf',
        type: 'String',
        relationship: 'BelongsTo',
        reference: 'teams.id',
      });
      expect(relation).not.toHaveProperty('inverseOf');
    });

    it('should name the targets of a polymorphic relation, which carries no reference', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });

      expect(fieldNamed(context, 'ownerPolymorphic')).toEqual({
        field: 'ownerPolymorphic',
        type: 'String',
        relationship: 'BelongsTo',
        polymorphicTargets: ['users', 'teams'],
      });
    });

    it('should tell a to-many relation from a to-one, which share the reference shape', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });

      expect(fieldNamed(context, 'ordersHasManyWithInverseOf')?.relationship).toBe('HasMany');
      expect(fieldNamed(context, 'teamBelongsToWithoutInverseOf')?.relationship).toBe('BelongsTo');
      expect(fieldNamed(context, 'id')).not.toHaveProperty('relationship');
    });

    it('should carry isRequired and isReadOnly only when true', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });

      expect(fieldNamed(context, 'emailRequired')?.isRequired).toBe(true);
      expect(fieldNamed(context, 'lockedReadOnly')?.isReadOnly).toBe(true);
      expect(fieldNamed(context, 'id')).not.toHaveProperty('isRequired');
      expect(fieldNamed(context, 'id')).not.toHaveProperty('isReadOnly');
    });
  });

  describe('when a field is an enum or a primary key', () => {
    it('should carry the allowed values, which the type alone does not give', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });

      expect(fieldNamed(context, 'statusWithEnums')?.enums).toEqual(['DRAFT', 'PUBLISHED']);
    });

    it('should flag the primary key, so a caller can build recordIds without a list call', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });

      expect(fieldNamed(context, 'id')?.isPrimaryKey).toBe(true);
      expect(fieldNamed(context, 'emailRequired')).not.toHaveProperty('isPrimaryKey');
    });

    it('should omit enums on a field that has none rather than send an empty list', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });

      expect(fieldNamed(context, 'id')).not.toHaveProperty('enums');
    });
  });

  describe('validations', () => {
    it('should keep the flags of a regex rule, which the agent emits on rewritten In filters', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });

      expect(fieldNamed(context, 'statusWithFlaggedPattern')?.validations).toEqual([
        { type: 'is like', value: '/^a|b|c$/g' },
      ]);
    });

    it('should carry the pattern a binary field requires, which the type alone cannot express', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });

      expect(fieldNamed(context, 'thumbnailWithPattern')?.validations).toEqual([
        { type: 'is like', value: '/^data:.*;base64,.*/' },
      ]);
    });

    it('should drop the message and invent no value on a rule that has neither', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });

      expect(fieldNamed(context, 'titleWithPresence')?.validations).toEqual([
        { type: 'is present' },
      ]);
    });

    it('should skip malformed entries instead of failing the whole contract', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });

      expect(fieldNamed(context, 'fieldWithMalformedValidations')?.validations).toEqual([
        { type: 'contains', value: 'ok' },
      ]);
    });

    it('should omit the key entirely when the agent sends null', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });

      expect(fieldNamed(context, 'fieldWithNullValidations')).not.toHaveProperty('validations');
    });

    it('should omit the key on a field with no validation at all', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });

      expect(fieldNamed(context, 'id')).not.toHaveProperty('validations');
    });
  });

  describe('when the schema carries actions', () => {
    it('should expose single, bulk and global actions alike', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });

      expect(usersOf(context)?.actions.map(entry => [entry.name, entry.type])).toEqual([
        ['Ban user', 'single'],
        ['Export all', 'global'],
        ['Archive', 'bulk'],
      ]);
    });

    it('should drop an action with no endpoint, matching the read-model allow-list', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });

      expect(readModel.isActionAllowed('users', 'Endpointless action')).toBe(false);
      expect(usersOf(context)?.actions.map(entry => entry.name)).not.toContain(
        'Endpointless action',
      );
    });

    it('should keep a falsy default value and an empty enum list, which carry meaning', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });
      const exportAction = usersOf(context)?.actions.find(entry => entry.name === 'Export all');

      expect(exportAction?.fields).toEqual([
        { field: 'includeArchived', type: 'Boolean', isRequired: false, defaultValue: false },
        { field: 'limit', type: 'Number', defaultValue: 0 },
        { field: 'since', type: 'Date', defaultValue: null },
        { field: 'format', type: 'Enum', enums: [] },
        { field: 'loading', type: 'String' },
      ]);
    });

    it('should omit enums when the agent sends null, which it does on every dynamic form', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });
      const loading = usersOf(context)
        ?.actions.find(entry => entry.name === 'Export all')
        ?.fields.find(entry => entry.field === 'loading');

      expect(loading).not.toHaveProperty('enums');
    });

    it('should skip a null action field rather than fail the whole contract', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });
      const archive = usersOf(context)?.actions.find(entry => entry.name === 'Archive');

      expect(archive?.fields).toEqual([{ field: 'confirm', type: 'Boolean' }]);
    });

    it('should serialize an action field with its enums and default value', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });
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

  describe('when a relation points at a collection the document does not serve', () => {
    it('should still name the target, leaving the cross-check to the consumer', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });
      const served = context.collections.map(collection => collection.name);

      expect(served).not.toContain('orders');
      expect(served).not.toContain('teams');
      expect(fieldNamed(context, 'ordersHasManyWithInverseOf')?.reference).toBe(
        'orders.customerId',
      );
      expect(fieldNamed(context, 'ownerPolymorphic')?.polymorphicTargets).toEqual([
        'users',
        'teams',
      ]);
    });
  });

  describe('when a relation targets a collection whose name contains dots', () => {
    it('should keep the reference whole so only the trailing segment is the key', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });

      expect(fieldNamed(context, 'addressBelongsToDottedCollection')?.reference).toBe(
        'User.address.city',
      );
    });
  });

  describe('when a collection name is unusual', () => {
    it('should keep a dotted name and a name carrying a space verbatim', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });

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
      const context = buildContext(schema, readModel, { schemaRevision: 1 });

      expect(
        context.collections.find(
          collection => collection.name === 'collectionWithoutFieldsNorActions',
        ),
      ).toEqual({ name: 'collectionWithoutFieldsNorActions', fields: [], actions: [] });
    });
  });

  describe('meta', () => {
    it('should carry the schema revision it was built from', () => {
      expect(buildContext(schema, readModel, { schemaRevision: 7 }).meta).toEqual({
        schemaRevision: 7,
      });
    });

    it('should carry the environment id when the deployment resolved one', () => {
      expect(
        buildContext(schema, readModel, { schemaRevision: 7, environmentId: 42 }).meta,
      ).toEqual({ schemaRevision: 7, environmentId: 42 });
    });

    it('should omit the environment id rather than send null when none was resolved', () => {
      const { meta } = buildContext(schema, readModel, { schemaRevision: 7 });

      expect(meta).not.toHaveProperty('environmentId');
    });
  });

  describe('identity', () => {
    it('should expose collections and meta only, so no identity can ride along', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });

      expect(Object.keys(context).sort()).toEqual(['collections', 'meta']);
      expect(Object.keys(context.meta)).toEqual(['schemaRevision']);
    });

    it('should expose only the agreed keys on a collection, a field and an action', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 1 });
      const users = usersOf(context);

      expect(Object.keys(users ?? {}).sort()).toEqual(['actions', 'fields', 'name']);
      expect(Object.keys(fieldNamed(context, 'ordersHasManyWithInverseOf') ?? {}).sort()).toEqual([
        'field',
        'inverseOf',
        'reference',
        'relationship',
        'type',
      ]);
      expect(Object.keys(users?.actions[0] ?? {}).sort()).toEqual(['fields', 'id', 'name', 'type']);
    });
  });

  describe('when the built context is validated against the published OpenAPI schema', () => {
    it('should round-trip through ContextResponseSchema for every shape the fixture covers', () => {
      const context = buildContext(schema, readModel, { schemaRevision: 3, environmentId: 42 });

      expect(ContextResponseSchema.parse(context)).toStrictEqual(context);
    });
  });
});
