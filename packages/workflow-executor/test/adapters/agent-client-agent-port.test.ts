/* eslint-disable max-classes-per-file */
import type { StepUser } from '../../src/types/execution-context';

import {
  AgentHttpError,
  ActionRequiresApprovalError as ClientApprovalError,
  ApprovalRequestCreationError as ClientApprovalRequestCreationError,
  ActionFormValidationError as ClientFormValidationError,
  UnknownActionFieldError as ClientUnknownActionFieldError,
  HttpRequester,
  createRemoteAgentClient,
} from '@forestadmin/agent-client';
import jsonwebtoken from 'jsonwebtoken';

import AgentClientAgentPort from '../../src/adapters/agent-client-agent-port';
import {
  ActionFormValidationError,
  ActionRequiresApprovalError,
  AgentPortError,
  AgentProbeError,
  ApprovalRequestCreationError,
  RecordNotFoundError,
} from '../../src/errors';
import SchemaCache from '../../src/schema-cache';

jest.mock('@forestadmin/agent-client', () => {
  // Real class so `instanceof AgentHttpError` in the adapter matches errors built by these tests.
  class MockAgentHttpError extends Error {
    constructor(
      public readonly status: number,
      public readonly body: unknown,
      public readonly responseText?: string,
    ) {
      super(`Agent responded with HTTP ${status}`);
      this.name = 'AgentHttpError';
    }
  }

  // Semantic action errors agent-client throws from execute(); real classes so the adapter's
  // `instanceof` checks match errors built by these tests.
  class MockActionRequiresApprovalError extends Error {
    constructor(message: string, public readonly roleIdsAllowedToApprove?: number[]) {
      super(message);
      this.name = 'ActionRequiresApprovalError';
    }
  }

  class MockActionFormValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ActionFormValidationError';
    }
  }

  class MockUnknownActionFieldError extends Error {
    constructor(fieldName: string) {
      super(`Field "${fieldName}" does not exist in this form`);
      this.name = 'UnknownActionFieldError';
    }
  }

  class MockApprovalRequestCreationError extends Error {
    constructor(public readonly cause?: unknown) {
      super('The approval request could not be created.');
      this.name = 'ApprovalRequestCreationError';
    }
  }

  return {
    AgentHttpError: MockAgentHttpError,
    ActionRequiresApprovalError: MockActionRequiresApprovalError,
    ActionFormValidationError: MockActionFormValidationError,
    ApprovalRequestCreationError: MockApprovalRequestCreationError,
    UnknownActionFieldError: MockUnknownActionFieldError,
    createRemoteAgentClient: jest.fn(),
    HttpRequester: { is404Error: jest.fn() },
  };
});

const mockedCreateRemoteAgentClient = createRemoteAgentClient as jest.MockedFunction<
  typeof createRemoteAgentClient
>;
const mockedIs404Error = HttpRequester.is404Error as jest.MockedFunction<
  typeof HttpRequester.is404Error
>;

function createMockClient() {
  const mockAction = {
    execute: jest.fn(),
    getFields: jest.fn().mockReturnValue([]),
    setFields: jest.fn().mockResolvedValue(undefined),
    tryToSetFields: jest.fn().mockResolvedValue([]),
    getEnumField: jest.fn(),
  };
  const mockRelation = { list: jest.fn() };
  const mockCollection = {
    list: jest.fn(),
    getOne: jest.fn(),
    update: jest.fn(),
    relation: jest.fn().mockReturnValue(mockRelation),
    action: jest.fn().mockResolvedValue(mockAction),
  };

  const client = {
    collection: jest.fn().mockReturnValue(mockCollection),
  };

  return { client, mockCollection, mockRelation, mockAction };
}

describe('AgentClientAgentPort', () => {
  let mockCollection: ReturnType<typeof createMockClient>['mockCollection'];
  let mockRelation: ReturnType<typeof createMockClient>['mockRelation'];
  let mockAction: ReturnType<typeof createMockClient>['mockAction'];
  let mockClient: ReturnType<typeof createMockClient>['client'];
  let user: StepUser;
  let port: AgentClientAgentPort;

  beforeEach(() => {
    jest.clearAllMocks();

    const mocks = createMockClient();
    ({ mockCollection, mockRelation, mockAction, client: mockClient } = mocks);
    mockedCreateRemoteAgentClient.mockReturnValue(mocks.client as any);

    const schemaCache = new SchemaCache();
    schemaCache.set(1, 'users', {
      collectionName: 'users',
      collectionId: 'col-users',
      collectionDisplayName: 'Users',
      primaryKeyFields: ['id'],
      fields: [
        { fieldName: 'id', displayName: 'id', isRelationship: false },
        { fieldName: 'name', displayName: 'name', isRelationship: false },
      ],
      actions: [
        { name: 'sendEmail', displayName: 'Send Email', endpoint: '/forest/actions/sendEmail' },
        { name: 'archive', displayName: 'Archive', endpoint: '/forest/actions/archive' },
      ],
    });
    schemaCache.set(1, 'orders', {
      collectionName: 'orders',
      collectionId: 'col-orders',
      collectionDisplayName: 'Orders',
      primaryKeyFields: ['tenantId', 'orderId'],
      fields: [
        { fieldName: 'tenantId', displayName: 'Tenant', isRelationship: false },
        { fieldName: 'orderId', displayName: 'Order', isRelationship: false },
      ],
      actions: [],
    });
    schemaCache.set(1, 'posts', {
      collectionName: 'posts',
      collectionId: 'col-posts',
      collectionDisplayName: 'Posts',
      primaryKeyFields: ['id'],
      fields: [
        { fieldName: 'id', displayName: 'id', isRelationship: false },
        { fieldName: 'title', displayName: 'title', isRelationship: false },
      ],
      actions: [],
    });

    user = {
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      team: 'admin',
      renderingId: 1,
      role: 'admin',
      permissionLevel: 'admin',
      tags: {},
    };

    port = new AgentClientAgentPort({
      agentUrl: 'http://localhost:3310',
      authSecret: 'test-secret',
      schemaCache,
    });
  });

  describe('getRecord', () => {
    it('should return a RecordData for a simple PK', async () => {
      mockCollection.getOne.mockResolvedValue({ id: 42, name: 'Alice' });

      const result = await port.getRecord({ collection: 'users', id: [42] }, user);

      expect(mockCollection.getOne).toHaveBeenCalledWith([42], {});
      expect(result).toEqual({
        collectionName: 'users',
        recordId: [42],
        values: { id: 42, name: 'Alice' },
      });
    });

    it('should pass the composite id opaquely (no primary-key ordering assumption)', async () => {
      mockCollection.getOne.mockResolvedValue({ tenantId: 1, orderId: 2 });

      await port.getRecord({ collection: 'orders', id: [1, 2] }, user);

      // The id is forwarded as-is; the agent resolves the primary key column order.
      expect(mockCollection.getOne).toHaveBeenCalledWith([1, 2], {});
    });

    it('should throw a RecordNotFoundError when no record is found', async () => {
      mockCollection.getOne.mockResolvedValue(null);

      await expect(port.getRecord({ collection: 'users', id: [999] }, user)).rejects.toThrow(
        RecordNotFoundError,
      );
    });

    it('maps a 404 from the agent to RecordNotFoundError', async () => {
      mockedIs404Error.mockReturnValue(true);
      mockCollection.getOne.mockRejectedValue(new Error('not found'));

      await expect(port.getRecord({ collection: 'users', id: [999] }, user)).rejects.toThrow(
        RecordNotFoundError,
      );
    });

    it('rethrows non-404 errors instead of masking them as RecordNotFoundError', async () => {
      // A 500 / auth / network failure must surface as a real error, not "record not found".
      mockedIs404Error.mockReturnValue(false);
      mockCollection.getOne.mockRejectedValue(new Error('boom'));

      await expect(port.getRecord({ collection: 'users', id: [1] }, user)).rejects.toThrow(
        AgentPortError,
      );
    });

    it('treats a 200 with an empty body as RecordNotFoundError (missing composite record)', async () => {
      mockCollection.getOne.mockResolvedValue({});

      await expect(port.getRecord({ collection: 'orders', id: [1, 2] }, user)).rejects.toThrow(
        RecordNotFoundError,
      );
    });

    it('should pass fields to getOne when fields is provided', async () => {
      mockCollection.getOne.mockResolvedValue({ id: 42, name: 'Alice' });

      await port.getRecord({ collection: 'users', id: [42], fields: ['id', 'name'] }, user);

      expect(mockCollection.getOne).toHaveBeenCalledWith([42], { fields: ['id', 'name'] });
    });

    it('should not pass fields to getOne when fields is an empty array', async () => {
      mockCollection.getOne.mockResolvedValue({ id: 42, name: 'Alice' });

      await port.getRecord({ collection: 'users', id: [42], fields: [] }, user);

      expect(mockCollection.getOne).toHaveBeenCalledWith([42], {});
    });

    it('should restore snake_case field names when agent returns camelCase keys', async () => {
      // The agent-client HTTP layer deserializes JSON:API responses with camelCase keys.
      // restoreFieldNames must map them back to the original snake_case names.
      mockCollection.getOne.mockResolvedValue({ cardNumber: '4111', isActive: true });

      const result = await port.getRecord(
        { collection: 'users', id: [42], fields: ['card_number', 'is_active'] },
        user,
      );

      expect(result.values).toEqual({ card_number: '4111', is_active: true });
    });

    it('should not pass fields to getOne when fields is undefined', async () => {
      mockCollection.getOne.mockResolvedValue({ id: 42, name: 'Alice' });

      await port.getRecord({ collection: 'users', id: [42] }, user);

      expect(mockCollection.getOne).toHaveBeenCalledWith([42], {});
    });

    it('works without a cached schema (no primary-key lookup needed)', async () => {
      mockCollection.getOne.mockResolvedValue({ id: 1 });

      const result = await port.getRecord({ collection: 'unknown', id: [1] }, user);

      expect(mockCollection.getOne).toHaveBeenCalledWith([1], {});
      expect(result.collectionName).toBe('unknown');
    });
  });

  describe('agent JWT', () => {
    it('signs both camelCase and snake_case identity claims for cross-runtime agents', async () => {
      mockCollection.getOne.mockResolvedValue({ id: 42 });

      await port.getRecord({ collection: 'users', id: [42] }, user);

      const { token } = mockedCreateRemoteAgentClient.mock.calls[0][0];
      const payload = jsonwebtoken.verify(token, 'test-secret') as Record<string, unknown>;

      expect(payload).toMatchObject({
        firstName: 'Test',
        lastName: 'User',
        renderingId: 1,
        permissionLevel: 'admin',
        first_name: 'Test',
        last_name: 'User',
        rendering_id: 1,
        permission_level: 'admin',
        scope: 'step-execution',
      });
    });
  });

  describe('updateRecord', () => {
    it('should forward the RecordId array to agent-client and return a RecordData', async () => {
      mockCollection.update.mockResolvedValue({ id: 42, name: 'Bob' });

      const result = await port.updateRecord(
        {
          collection: 'users',
          id: [42],
          values: { name: 'Bob' },
        },
        user,
      );

      expect(mockCollection.update).toHaveBeenCalledWith([42], { name: 'Bob' });
      expect(result).toEqual({
        collectionName: 'users',
        recordId: [42],
        values: { id: 42, name: 'Bob' },
      });
    });

    it('should forward composite PKs as arrays (agent-client handles pipe encoding)', async () => {
      mockCollection.update.mockResolvedValue({ tenantId: 1, orderId: 2 });

      await port.updateRecord(
        { collection: 'orders', id: [1, 2], values: { status: 'done' } },
        user,
      );

      expect(mockCollection.update).toHaveBeenCalledWith([1, 2], { status: 'done' });
    });

    it('should restore snake_case field names when agent returns camelCase keys', async () => {
      mockCollection.update.mockResolvedValue({ cardNumber: '4111', isActive: true });

      const result = await port.updateRecord(
        { collection: 'users', id: [42], values: { card_number: '4111', is_active: true } },
        user,
      );

      expect(result.values).toEqual({ card_number: '4111', is_active: true });
    });
  });

  describe('getRelatedData', () => {
    const postsSchema = {
      collectionName: 'posts',
      collectionId: 'col-posts',
      collectionDisplayName: 'Posts',
      primaryKeyFields: ['id'],
      fields: [
        { fieldName: 'id', displayName: 'id', isRelationship: false, type: 'Number' as const },
        {
          fieldName: 'title',
          displayName: 'title',
          isRelationship: false,
          type: 'String' as const,
        },
      ],
      actions: [],
    };

    it('maps raw rows to RecordData using the supplied related schema', async () => {
      mockRelation.list.mockResolvedValue([
        { id: 10, title: 'Post A' },
        { id: 11, title: 'Post B' },
      ]);

      const result = await port.getRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'posts',
          relatedSchema: postsSchema,
          limit: null,
        },
        user,
      );

      expect(mockCollection.relation).toHaveBeenCalledWith('posts', [42]);
      expect(result).toEqual([
        { collectionName: 'posts', recordId: [10], values: { id: 10, title: 'Post A' } },
        { collectionName: 'posts', recordId: [11], values: { id: 11, title: 'Post B' } },
      ]);
    });

    it('restores snake_case field names from camelCase deserialized rows', async () => {
      const snakeSchema = {
        ...postsSchema,
        primaryKeyFields: ['post_id'],
        fields: [
          {
            fieldName: 'post_id',
            displayName: 'Post id',
            isRelationship: false,
            type: 'Number' as const,
          },
          {
            fieldName: 'created_at',
            displayName: 'Created at',
            isRelationship: false,
            type: 'Date' as const,
          },
        ],
      };
      mockRelation.list.mockResolvedValue([{ postId: 99, createdAt: '2024-01-01' }]);

      const result = await port.getRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'posts',
          relatedSchema: snakeSchema,
          limit: null,
        },
        user,
      );

      expect(result).toEqual([
        {
          collectionName: 'posts',
          recordId: [99],
          values: { post_id: 99, created_at: '2024-01-01' },
        },
      ]);
    });

    // A PascalCase PK that isn't restored yields recordId [undefined] — a corrupt id that later
    // steps resolve against, unlike the null an unresolved xToOne relation returns.
    it('restores PascalCase field names, keeping the single PK resolvable', async () => {
      const pascalSchema = {
        ...postsSchema,
        primaryKeyFields: ['Id'],
        fields: [
          { fieldName: 'Id', displayName: 'Id', isRelationship: false, type: 'Number' as const },
          {
            fieldName: 'CreatedAt',
            displayName: 'Created at',
            isRelationship: false,
            type: 'Date' as const,
          },
        ],
      };
      mockRelation.list.mockResolvedValue([{ id: 99, createdAt: '2024-01-01' }]);

      const result = await port.getRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'posts',
          relatedSchema: pascalSchema,
          limit: null,
        },
        user,
      );

      expect(result).toEqual([
        {
          collectionName: 'posts',
          recordId: [99],
          values: { Id: 99, CreatedAt: '2024-01-01' },
        },
      ]);
    });

    it('uses the agent opaque record id for composite PKs (no schema-order assumption)', async () => {
      const compositeSchema = {
        ...postsSchema,
        primaryKeyFields: ['tenantId', 'postId'],
        fields: [
          {
            fieldName: 'tenantId',
            displayName: 'Tenant',
            isRelationship: false,
            type: 'String' as const,
          },
          {
            fieldName: 'postId',
            displayName: 'Post',
            isRelationship: false,
            type: 'Number' as const,
          },
        ],
      };
      // The agent serializes the (composite) record id; we reuse it rather than rebuilding it
      // from primaryKeyFields, so the column order is the agent's, not the schema's alphabetical one.
      mockRelation.list.mockResolvedValue([{ id: 'acme|7', tenantId: 'acme', postId: 7 }]);

      const result = await port.getRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'posts',
          relatedSchema: compositeSchema,
          limit: null,
        },
        user,
      );

      expect(result[0].recordId).toEqual(['acme', '7']);
    });

    it('applies pagination when limit is a number', async () => {
      mockRelation.list.mockResolvedValue([{ id: 10, title: 'Post A' }]);

      await port.getRelatedData(
        { collection: 'users', id: [42], relation: 'posts', relatedSchema: postsSchema, limit: 5 },
        user,
      );

      expect(mockRelation.list).toHaveBeenCalledWith(
        expect.objectContaining({ pagination: { size: 5, number: 1 } }),
      );
    });

    it('does not apply pagination when limit is null', async () => {
      mockRelation.list.mockResolvedValue([]);

      await port.getRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'posts',
          relatedSchema: postsSchema,
          limit: null,
        },
        user,
      );

      expect(mockRelation.list).toHaveBeenCalledWith({});
    });

    it('returns an empty array when no related data exists', async () => {
      mockRelation.list.mockResolvedValue([]);

      expect(
        await port.getRelatedData(
          {
            collection: 'users',
            id: [42],
            relation: 'posts',
            relatedSchema: postsSchema,
            limit: null,
          },
          user,
        ),
      ).toEqual([]);
    });

    it('forwards fields to the list call when provided', async () => {
      mockRelation.list.mockResolvedValue([{ id: 10, title: 'Post A' }]);

      await port.getRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'posts',
          relatedSchema: postsSchema,
          limit: null,
          fields: ['title'],
        },
        user,
      );

      expect(mockRelation.list).toHaveBeenCalledWith(
        expect.objectContaining({ fields: ['title'] }),
      );
    });

    it('omits fields from the list call when not provided', async () => {
      mockRelation.list.mockResolvedValue([{ id: 10 }]);

      await port.getRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'posts',
          relatedSchema: postsSchema,
          limit: null,
        },
        user,
      );

      expect(mockRelation.list).toHaveBeenCalledWith(
        expect.not.objectContaining({ fields: expect.anything() }),
      );
    });
  });

  describe('getSingleRelatedData', () => {
    // xToOne relations don't expose /relationships/<relation> on the agent, so the port reads the
    // relation off the parent's RAW JSON:API body. Deserializing it would be lossy: a linkage with
    // no matching `included` entry is dropped entirely, and no agent compounds a smart relation.
    const ordersSchema = {
      collectionName: 'orders',
      collectionId: 'col-orders',
      collectionDisplayName: 'Orders',
      primaryKeyFields: ['id'],
      fields: [
        { fieldName: 'id', displayName: 'id', isRelationship: false, type: 'Number' as const },
        {
          fieldName: 'reference',
          displayName: 'Reference',
          isRelationship: false,
          type: 'String' as const,
        },
      ],
      actions: [],
    };

    const parentWithLinkage = (relation: string, data: { id?: string } | null) => ({
      data: { type: 'users', id: '42', attributes: {}, relationships: { [relation]: { data } } },
    });

    const parentWithAttribute = (relation: string, value: unknown) => ({
      data: { type: 'users', id: '42', attributes: { [relation]: value }, relationships: {} },
    });

    // The Qonto shape: a forest-rails smart `belongs_to` emits the linkage but never lands in
    // `included` (only real ActiveRecord associations reach the agent's `include`), so the
    // deserializer used to eat the key and the step reported "no record loaded".
    it('follows a linkage that has no included entry', async () => {
      mockCollection.getOne
        .mockResolvedValueOnce(parentWithLinkage('card', { id: 'uuid-1' }))
        .mockResolvedValueOnce({ reference: 'CARD-1' });

      const result = await port.getSingleRelatedData(
        {
          collection: 'claims',
          id: [42],
          relation: 'card',
          relatedSchema: { ...ordersSchema, collectionName: 'cards' },
          fields: ['reference'],
        },
        user,
      );

      expect(mockCollection.getOne).toHaveBeenNthCalledWith(
        1,
        [42],
        { fields: ['card@@@reference'] },
        { skipDeserialization: true },
      );
      expect(mockCollection.getOne).toHaveBeenNthCalledWith(2, ['uuid-1'], {
        fields: ['reference'],
      });
      expect(mockClient.collection).toHaveBeenCalledWith('cards');
      expect(result).toEqual({
        collectionName: 'cards',
        recordId: ['uuid-1'],
        values: { reference: 'CARD-1' },
      });
    });

    // A forest-rails `field ... reference:` serializes as a plain attribute whose value IS the id.
    it('follows an attribute whose value is the related id', async () => {
      mockCollection.getOne
        .mockResolvedValueOnce(parentWithAttribute('card', 'uuid-1'))
        .mockResolvedValueOnce({ reference: 'CARD-1' });

      const result = await port.getSingleRelatedData(
        {
          collection: 'claims',
          id: [42],
          relation: 'card',
          relatedSchema: { ...ordersSchema, collectionName: 'cards' },
          fields: ['reference'],
        },
        user,
      );

      expect(mockCollection.getOne).toHaveBeenNthCalledWith(2, ['uuid-1'], {
        fields: ['reference'],
      });
      expect(result?.recordId).toEqual(['uuid-1']);
    });

    // Captured from forest-rails: a `field ... reference:` block returning the record — not its id
    // — serializes the whole record under the attribute.
    it('follows an attribute holding the record itself, reading its id', async () => {
      mockCollection.getOne
        .mockResolvedValueOnce(
          parentWithAttribute('card', { id: 2, name: 'Unrelated', title: null }),
        )
        .mockResolvedValueOnce({ reference: 'CARD-1' });

      const result = await port.getSingleRelatedData(
        {
          collection: 'claims',
          id: [42],
          relation: 'card',
          relatedSchema: { ...ordersSchema, collectionName: 'cards' },
          fields: ['reference'],
        },
        user,
      );

      expect(mockCollection.getOne).toHaveBeenNthCalledWith(2, ['2'], { fields: ['reference'] });
      expect(result?.recordId).toEqual(['2']);
    });

    // The caller reads `values` only for the reference field it asked for, so with nothing to
    // project the linkage id is the whole answer and the target read would fetch a record to
    // discard it.
    it('returns the linkage id without reading the target when no field is projected', async () => {
      mockCollection.getOne.mockResolvedValue(parentWithLinkage('card', { id: 'uuid-1' }));

      const result = await port.getSingleRelatedData(
        {
          collection: 'claims',
          id: [42],
          relation: 'card',
          relatedSchema: { ...ordersSchema, collectionName: 'cards' },
        },
        user,
      );

      expect(mockCollection.getOne).toHaveBeenCalledTimes(1);
      expect(mockCollection.getOne).toHaveBeenCalledWith(
        [42],
        { fields: ['card@@@id'] },
        { skipDeserialization: true },
      );
      expect(result).toEqual({
        collectionName: 'cards',
        recordId: ['uuid-1'],
        values: {},
      });
    });

    // The by-id route intersects the caller's scope; the relation projected on the parent does not.
    // A linkage to a record this caller cannot see is "no related record", not a broken run.
    it('returns null when the target is unreadable, instead of failing the step', async () => {
      mockedIs404Error.mockReturnValue(true);
      mockCollection.getOne
        .mockResolvedValueOnce(parentWithLinkage('card', { id: 'uuid-1' }))
        .mockRejectedValueOnce(new Error('not found'));

      const result = await port.getSingleRelatedData(
        {
          collection: 'claims',
          id: [42],
          relation: 'card',
          relatedSchema: { ...ordersSchema, collectionName: 'cards' },
          fields: ['reference'],
        },
        user,
      );

      expect(result).toBeNull();
      expect(mockCollection.getOne).toHaveBeenCalledTimes(2);
    });

    it('rethrows a non-404 on the target read', async () => {
      mockedIs404Error.mockReturnValue(false);
      mockCollection.getOne
        .mockResolvedValueOnce(parentWithLinkage('card', { id: 'uuid-1' }))
        .mockRejectedValueOnce(new Error('boom'));

      await expect(
        port.getSingleRelatedData(
          {
            collection: 'claims',
            id: [42],
            relation: 'card',
            relatedSchema: { ...ordersSchema, collectionName: 'cards' },
            fields: ['reference'],
          },
          user,
        ),
      ).rejects.toThrow(AgentPortError);
    });

    it('projects the caller field, not the PK, and passes it to the target read', async () => {
      mockCollection.getOne
        .mockResolvedValueOnce(parentWithLinkage('order', { id: '99' }))
        .mockResolvedValueOnce({ reference: 'ORD-2026-001' });

      const result = await port.getSingleRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'order',
          relatedSchema: ordersSchema,
          fields: ['reference'],
        },
        user,
      );

      expect(mockCollection.getOne).toHaveBeenNthCalledWith(
        1,
        [42],
        { fields: ['order@@@reference'] },
        { skipDeserialization: true },
      );
      expect(mockCollection.getOne).toHaveBeenNthCalledWith(2, ['99'], { fields: ['reference'] });
      expect(result?.values).toEqual({ reference: 'ORD-2026-001' });
    });

    // Single sub-field only: the agent can't parse `fields[order]=id,reference`.
    it('projects at most one sub-field even when the caller passes several', async () => {
      mockCollection.getOne
        .mockResolvedValueOnce(parentWithLinkage('order', { id: '99' }))
        .mockResolvedValueOnce({ reference: 'ORD-2026-001' });

      await port.getSingleRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'order',
          relatedSchema: ordersSchema,
          fields: ['reference', 'label'],
        },
        user,
      );

      expect(mockCollection.getOne).toHaveBeenNthCalledWith(
        1,
        [42],
        { fields: ['order@@@reference'] },
        { skipDeserialization: true },
      );
    });

    // Raw keys are the agent's own field names. Reading the deserialized record instead forced an
    // inflection guess (billing_address → billingAddress, KYCEvent → kycEvent) that had to match
    // the deserializer's exactly, or the relation silently resolved to nothing.
    it.each(['billing_address', 'BillingAddress', 'billing-address', 'KYCEvent'])(
      'reads the relation under its raw name (%s)',
      async relation => {
        mockCollection.getOne
          .mockResolvedValueOnce(parentWithLinkage(relation, { id: 'ba-1' }))
          .mockResolvedValueOnce({ id: 'ba-1' });

        const result = await port.getSingleRelatedData(
          {
            collection: 'users',
            id: [42],
            relation,
            relatedSchema: { ...ordersSchema, collectionName: 'addresses' },
          },
          user,
        );

        expect(mockCollection.getOne).toHaveBeenNthCalledWith(
          1,
          [42],
          { fields: [`${relation}@@@id`] },
          { skipDeserialization: true },
        );
        expect(result?.recordId).toEqual(['ba-1']);
      },
    );

    it('splits the packed id when the target key is composite', async () => {
      mockCollection.getOne
        .mockResolvedValueOnce(parentWithLinkage('order', { id: 'acme|7' }))
        .mockResolvedValueOnce({ reference: 'ORD-1' });

      const result = await port.getSingleRelatedData(
        {
          collection: 'users',
          id: [42],
          relation: 'order',
          relatedSchema: { ...ordersSchema, primaryKeyFields: ['tenantId', 'orderId'] },
          fields: ['reference'],
        },
        user,
      );

      expect(mockCollection.getOne).toHaveBeenNthCalledWith(2, ['acme', '7'], {
        fields: ['reference'],
      });
      expect(result?.recordId).toEqual(['acme', '7']);
    });

    // A single-key value is never split — the pipe is data, not packing. It is not loadable either:
    // agent-client's serializeRecordId refuses a pipe in a key part (covered in its own suite), and
    // an agent would unpack it into the wrong number of parts. This pins the no-split, not a load.
    it('does not split a single-key value on the pipe', async () => {
      mockCollection.getOne
        .mockResolvedValueOnce(parentWithAttribute('card', 'acme|corp'))
        .mockResolvedValueOnce({ reference: 'CARD-1' });

      const result = await port.getSingleRelatedData(
        {
          collection: 'claims',
          id: [42],
          relation: 'card',
          relatedSchema: { ...ordersSchema, collectionName: 'cards' },
          fields: ['reference'],
        },
        user,
      );

      expect(mockCollection.getOne).toHaveBeenNthCalledWith(2, ['acme|corp'], {
        fields: ['reference'],
      });
      expect(result?.recordId).toEqual(['acme|corp']);
    });

    // `object.card&.id.to_s` is the idiomatic Ruby getter, and it answers "" for an unset
    // association. Reading it as an id would build an id-less URL that agents route to the index.
    it.each([
      ['an empty linkage', () => parentWithLinkage('card', null)],
      ['a linkage without an id', () => parentWithLinkage('card', {})],
      ['no relationship nor attribute', () => ({ data: { type: 'claims', id: '42' } })],
      ['a null attribute', () => parentWithAttribute('card', null)],
      ['an empty-string attribute', () => parentWithAttribute('card', '')],
    ])('returns null on %s, without reading the target', async (_label, parent) => {
      mockCollection.getOne.mockResolvedValue(parent());

      const result = await port.getSingleRelatedData(
        {
          collection: 'claims',
          id: [42],
          relation: 'card',
          relatedSchema: { ...ordersSchema, collectionName: 'cards' },
        },
        user,
      );

      expect(result).toBeNull();
      expect(mockCollection.getOne).toHaveBeenCalledTimes(1);
    });

    // Some agents answer a missing composite-key record with a 200 + empty body. Returning null
    // there would report "no record to load" for a parent nobody read.
    it.each([{}, { data: null }])(
      'treats a 200 with an empty parent body (%j) as RecordNotFoundError',
      async body => {
        mockCollection.getOne.mockResolvedValue(body);

        await expect(
          port.getSingleRelatedData(
            { collection: 'claims', id: [42], relation: 'card', relatedSchema: ordersSchema },
            user,
          ),
        ).rejects.toThrow(RecordNotFoundError);
        expect(mockCollection.getOne).toHaveBeenCalledTimes(1);
      },
    );

    it('maps a 404 on the parent to RecordNotFoundError', async () => {
      mockedIs404Error.mockReturnValue(true);
      mockCollection.getOne.mockRejectedValue(new Error('not found'));

      await expect(
        port.getSingleRelatedData(
          { collection: 'claims', id: [999], relation: 'card', relatedSchema: ordersSchema },
          user,
        ),
      ).rejects.toThrow(RecordNotFoundError);
    });

    it('rethrows a non-404 on the parent instead of masking it as RecordNotFoundError', async () => {
      mockedIs404Error.mockReturnValue(false);
      mockCollection.getOne.mockRejectedValue(new Error('boom'));

      await expect(
        port.getSingleRelatedData(
          { collection: 'claims', id: [42], relation: 'card', relatedSchema: ordersSchema },
          user,
        ),
      ).rejects.toThrow(AgentPortError);
    });
  });

  describe('executeAction', () => {
    it('should forward the RecordId array to agent-client and normalize the executed result', async () => {
      mockAction.execute.mockResolvedValue({ success: 'done' });

      const result = await port.executeAction(
        {
          collection: 'users',
          action: 'sendEmail',
          id: [1],
        },
        { user },
      );

      expect(mockCollection.action).toHaveBeenCalledWith('sendEmail', { recordIds: [[1]] });
      // The opaque executed result is wrapped under `result` (port contract).
      expect(result).toEqual({ result: { success: 'done' } });
    });

    it('normalizes an approval-gated submit into approvalRequested + the approval id', async () => {
      mockAction.execute.mockResolvedValue({
        approvalRequested: true,
        approvalRequest: { id: 'req_42' },
      });

      const result = await port.executeAction(
        { collection: 'users', action: 'sendEmail', id: [1] },
        { user },
      );

      expect(result).toEqual({ approvalRequested: true, approvalRequest: { id: 'req_42' } });
    });

    it('forwards the approvalMessage to execute so it reaches the approval request', async () => {
      mockAction.execute.mockResolvedValue({ approvalRequested: true });

      await port.executeAction(
        {
          collection: 'users',
          action: 'sendEmail',
          id: [1],
          approvalMessage: 'AI reasoning: resend requested by the workflow',
        },
        { user },
      );

      expect(mockAction.execute).toHaveBeenCalledWith({
        approvalRequestMessage: 'AI reasoning: resend requested by the workflow',
      });
    });

    it('wires the forestServer connection into agent-client when a server token is supplied', async () => {
      const portWithServer = new AgentClientAgentPort({
        agentUrl: 'http://localhost:3310',
        authSecret: 'test-secret',
        schemaCache: (port as unknown as { schemaCache: SchemaCache }).schemaCache,
        forestServerUrl: 'https://api.forestadmin.com',
      });
      mockAction.execute.mockResolvedValue({ success: 'done' });

      await portWithServer.executeAction(
        { collection: 'users', action: 'sendEmail', id: [1] },
        { user, forestServerToken: 'server-token' },
      );

      expect(mockedCreateRemoteAgentClient).toHaveBeenCalledWith(
        expect.objectContaining({
          forestServer: {
            serverUrl: 'https://api.forestadmin.com',
            serverToken: 'server-token',
            renderingId: 1,
          },
        }),
      );
    });

    it('omits the forestServer connection when no server token is supplied', async () => {
      const portWithServer = new AgentClientAgentPort({
        agentUrl: 'http://localhost:3310',
        authSecret: 'test-secret',
        schemaCache: (port as unknown as { schemaCache: SchemaCache }).schemaCache,
        forestServerUrl: 'https://api.forestadmin.com',
      });
      mockAction.execute.mockResolvedValue({ success: 'done' });

      await portWithServer.executeAction(
        { collection: 'users', action: 'sendEmail', id: [1] },
        { user },
      );

      expect(mockedCreateRemoteAgentClient).toHaveBeenCalledWith(
        expect.not.objectContaining({ forestServer: expect.anything() }),
      );
    });

    it('maps an approval-request creation failure to ApprovalRequestCreationError', async () => {
      mockAction.execute.mockRejectedValue(
        new ClientApprovalRequestCreationError(new Error('forest server down')),
      );

      await expect(
        port.executeAction({ collection: 'users', action: 'sendEmail', id: [1] }, { user }),
      ).rejects.toBeInstanceOf(ApprovalRequestCreationError);
    });

    it('should call execute with empty recordIds when ids is not provided', async () => {
      mockAction.execute.mockResolvedValue(undefined);

      await port.executeAction({ collection: 'users', action: 'archive' }, { user });

      expect(mockCollection.action).toHaveBeenCalledWith('archive', { recordIds: [] });
      expect(mockAction.execute).toHaveBeenCalled();
    });

    it('should propagate errors from action execution', async () => {
      mockAction.execute.mockRejectedValue(new Error('Action failed'));

      await expect(
        port.executeAction({ collection: 'users', action: 'sendEmail', id: [1] }, { user }),
      ).rejects.toThrow('Action failed');
    });

    it('sets pre-filled values (strict) before executing', async () => {
      mockAction.execute.mockResolvedValue({ success: 'done' });

      await port.executeAction(
        { collection: 'users', action: 'refund', id: [1], values: { amount: 50 } },
        { user },
      );

      expect(mockAction.setFields).toHaveBeenCalledWith({ amount: 50 });
      expect(mockAction.execute).toHaveBeenCalled();
    });

    it('maps an unknown field on setFields to ActionFormValidationError', async () => {
      mockAction.setFields.mockRejectedValue(new ClientUnknownActionFieldError('x'));

      await expect(
        port.executeAction(
          { collection: 'users', action: 'refund', id: [1], values: { x: 1 } },
          { user },
        ),
      ).rejects.toBeInstanceOf(ActionFormValidationError);
      expect(mockAction.execute).not.toHaveBeenCalled();
    });

    // A change hook rejecting the value is the customer's own validation, so Full AI must still
    // degrade to a human review rather than hard-erroring the step.
    it.each([400, 422])(
      'maps a %i from the change hook to ActionFormValidationError',
      async status => {
        mockAction.setFields.mockRejectedValue(new AgentHttpError(status, { errors: ['bad'] }));

        await expect(
          port.executeAction(
            { collection: 'users', action: 'refund', id: [1], values: { amount: -1 } },
            { user },
          ),
        ).rejects.toBeInstanceOf(ActionFormValidationError);
        expect(mockAction.execute).not.toHaveBeenCalled();
      },
    );

    // These are 4xx too, but they say nothing about the submitted value: telling the operator to fix
    // the form when the agent refused the caller or throttled it would send them after the wrong thing.
    it.each([401, 403, 404, 408, 429])(
      'does not blame the form for a %i from the change hook',
      async status => {
        mockAction.setFields.mockRejectedValue(new AgentHttpError(status, 'refused'));

        const error = await port
          .executeAction(
            { collection: 'users', action: 'refund', id: [1], values: { amount: 50 } },
            { user },
          )
          .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(AgentPortError);
        expect(error).not.toBeInstanceOf(ActionFormValidationError);
        expect((error as AgentPortError).errorKind).toBeUndefined();
        expect(mockAction.execute).not.toHaveBeenCalled();
      },
    );

    it('does not blame the form for a 5xx from the change hook', async () => {
      mockAction.setFields.mockRejectedValue(new AgentHttpError(500, 'hook crashed'));

      const error = await port
        .executeAction(
          { collection: 'users', action: 'refund', id: [1], values: { amount: 50 } },
          { user },
        )
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AgentPortError);
      expect(error).not.toBeInstanceOf(ActionFormValidationError);
      expect((error as AgentPortError).errorKind).toBeUndefined();
    });

    // setFields awaits a /hooks/change request for any field carrying a change hook, so it can fail
    // for reasons that have nothing to do with the submitted values.
    it('does not blame the form for a transport failure on setFields', async () => {
      mockAction.setFields.mockRejectedValue(new Error('socket hang up'));

      const error = await port
        .executeAction(
          { collection: 'users', action: 'refund', id: [1], values: { amount: 50 } },
          { user },
        )
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AgentPortError);
      expect(error).not.toBeInstanceOf(ActionFormValidationError);
      expect((error as AgentPortError).errorKind).toBeUndefined();
      expect(mockAction.execute).not.toHaveBeenCalled();
    });

    it('re-wraps agent-client ActionRequiresApprovalError, carrying the allowed roles', async () => {
      mockAction.execute.mockRejectedValue(new ClientApprovalError('Needs approval', [7, 9]));

      const error = await port
        .executeAction({ collection: 'users', action: 'refund', id: [1] }, { user })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ActionRequiresApprovalError);
      expect((error as ActionRequiresApprovalError).roleIdsAllowedToApprove).toEqual([7, 9]);
    });

    it('re-wraps agent-client ActionFormValidationError', async () => {
      mockAction.execute.mockRejectedValue(new ClientFormValidationError('invalid'));

      await expect(
        port.executeAction({ collection: 'users', action: 'refund', id: [1] }, { user }),
      ).rejects.toBeInstanceOf(ActionFormValidationError);
    });

    it('leaves a plain permission 403 as a generic AgentPortError (step error, not a fallback)', async () => {
      mockAction.execute.mockRejectedValue(
        new AgentHttpError(403, { errors: [{ name: 'ForbiddenError' }] }, 'Forbidden'),
      );

      await expect(
        port.executeAction({ collection: 'users', action: 'refund', id: [1] }, { user }),
      ).rejects.toBeInstanceOf(AgentPortError);
    });
  });

  describe('getActionForm', () => {
    function makeField(over: {
      name: string;
      type?: string;
      value?: unknown;
      required?: boolean;
      description?: string;
      options?: unknown[];
    }) {
      return {
        getName: () => over.name,
        getType: () => over.type ?? 'String',
        getValue: () => over.value,
        isRequired: () => over.required ?? false,
        getPlainField: () => ({ description: over.description }),
        getMultipleChoiceField: () => ({ getOptions: () => over.options }),
      };
    }

    it('returns the field list, completeness and skipped fields', async () => {
      mockAction.tryToSetFields.mockResolvedValue(['ghost']);
      mockAction.getFields.mockReturnValue([
        makeField({ name: 'amount', type: 'Number', value: 50, required: true }),
        makeField({ name: 'reason', type: 'String', required: true }),
        makeField({ name: 'tier', type: 'Enum', value: 'gold', required: false }),
      ]);
      mockAction.getEnumField.mockReturnValue({ getOptions: () => ['gold', 'silver'] });

      const form = await port.getActionForm(
        { collection: 'users', action: 'refund', id: [1], values: { amount: 50, ghost: 1 } },
        user,
      );

      expect(mockAction.tryToSetFields).toHaveBeenCalledWith({ amount: 50, ghost: 1 });
      expect(form.fields).toEqual([
        { name: 'amount', type: 'Number', value: 50, isRequired: true },
        { name: 'reason', type: 'String', value: undefined, isRequired: true },
        {
          name: 'tier',
          type: 'Enum',
          value: 'gold',
          isRequired: false,
          enumValues: ['gold', 'silver'],
        },
      ]);
      // 'reason' is required and empty → not executable yet; 'ghost' was dropped by the form.
      expect(form.canExecute).toBe(false);
      expect(form.requiredFields).toEqual(['reason']);
      expect(form.skippedFields).toEqual(['ghost']);
    });

    it('reports canExecute true when all required fields have values', async () => {
      mockAction.getFields.mockReturnValue([
        makeField({ name: 'amount', type: 'Number', value: 50, required: true }),
      ]);

      const form = await port.getActionForm(
        { collection: 'users', action: 'refund', id: [1] },
        user,
      );

      expect(form.canExecute).toBe(true);
      expect(form.requiredFields).toEqual([]);
      expect(mockAction.tryToSetFields).not.toHaveBeenCalled();
    });

    it('surfaces widget options and descriptions, normalizing primitive options', async () => {
      mockAction.getFields.mockReturnValue([
        makeField({
          name: 'plan',
          type: 'String',
          required: true,
          description: 'Subscription plan',
          options: [
            { label: 'Basic', value: 'basic' },
            { label: 'Premium', value: 'premium' },
          ],
        }),
        makeField({ name: 'priority', type: 'String', options: ['low', 'high'] }),
      ]);

      const form = await port.getActionForm(
        { collection: 'users', action: 'subscribe', id: [1] },
        user,
      );

      expect(form.fields).toEqual([
        {
          name: 'plan',
          type: 'String',
          value: undefined,
          isRequired: true,
          description: 'Subscription plan',
          allowedValues: [
            { value: 'basic', label: 'Basic' },
            { value: 'premium', label: 'Premium' },
          ],
        },
        {
          name: 'priority',
          type: 'String',
          value: undefined,
          isRequired: false,
          allowedValues: [
            { value: 'low', label: 'low' },
            { value: 'high', label: 'high' },
          ],
        },
      ]);
    });

    it('builds the form against no record when the id is omitted (global action)', async () => {
      mockAction.getFields.mockReturnValue([]);

      await port.getActionForm({ collection: 'users', action: 'archive' }, user);

      // Parity with executeAction: a global action carries no recordId.
      expect(mockCollection.action).toHaveBeenCalledWith('archive', { recordIds: [] });
    });
  });

  describe('getActionFormInfo', () => {
    it('returns hasForm:false when agent-client reports no fields', async () => {
      mockAction.getFields.mockReturnValue([]);

      const result = await port.getActionFormInfo(
        { collection: 'users', action: 'sendEmail', id: [1] },
        user,
      );

      expect(mockCollection.action).toHaveBeenCalledWith('sendEmail', { recordIds: [[1]] });
      expect(result).toEqual({ hasForm: false });
    });

    it('returns hasForm:true when agent-client reports at least one field', async () => {
      mockAction.getFields.mockReturnValue([{ getName: () => 'reason' }]);

      const result = await port.getActionFormInfo(
        { collection: 'users', action: 'sendEmail', id: [1] },
        user,
      );

      expect(result).toEqual({ hasForm: true });
    });

    it('forwards composite ids as arrays (agent-client handles pipe encoding)', async () => {
      mockAction.getFields.mockReturnValue([]);

      await port.getActionFormInfo(
        { collection: 'users', action: 'sendEmail', id: [1, 'abc'] },
        user,
      );

      expect(mockCollection.action).toHaveBeenCalledWith('sendEmail', { recordIds: [[1, 'abc']] });
    });
  });

  describe('buildActionEndpoints', () => {
    it('passes fields and hooks from schema to agent-client (supports Ruby agent fallback)', async () => {
      const schemaCache = new SchemaCache();
      schemaCache.set(1, 'users', {
        collectionName: 'users',
        collectionId: 'col-users',
        collectionDisplayName: 'Users',
        primaryKeyFields: ['id'],
        fields: [{ fieldName: 'id', displayName: 'id', isRelationship: false }],
        actions: [
          {
            name: 'refund',
            displayName: 'Refund',
            endpoint: '/forest/actions/refund',
            hooks: { load: true, change: ['amount'] },
            fields: [{ field: 'amount', type: 'Number', isRequired: true }],
          },
        ],
      });
      const customPort = new AgentClientAgentPort({
        agentUrl: 'http://localhost:3310',
        authSecret: 'secret',
        schemaCache,
      });

      await customPort.executeAction({ collection: 'users', action: 'refund', id: [1] }, { user });

      expect(mockedCreateRemoteAgentClient).toHaveBeenCalledWith(
        expect.objectContaining({
          actionEndpoints: {
            users: {
              refund: expect.objectContaining({
                name: 'refund',
                endpoint: '/forest/actions/refund',
                hooks: { load: true, change: ['amount'] },
                fields: [{ field: 'amount', type: 'Number', isRequired: true }],
              }),
            },
          },
        }),
      );
    });

    it('forwards omitted hooks/fields as-is so agent-client keeps probing /hooks/load', async () => {
      // Default schema in beforeEach has no hooks/fields on actions. They must NOT be coerced to
      // {load: false} / []: agent-client would then skip the probe and render an empty static
      // form where a legacy agent could have answered with the real one.
      await port.executeAction({ collection: 'users', action: 'sendEmail', id: [1] }, { user });

      expect(mockedCreateRemoteAgentClient).toHaveBeenCalledWith(
        expect.objectContaining({
          actionEndpoints: expect.objectContaining({
            users: expect.objectContaining({
              sendEmail: expect.objectContaining({
                hooks: undefined,
                fields: undefined,
              }),
            }),
          }),
        }),
      );
    });
  });

  describe('resolvePolymorphicType', () => {
    function linkageBody(data: unknown) {
      return { data: { relationships: { commentable: { data } } } };
    }

    it('reads the raw linkage via getOne and extracts { type, id }', async () => {
      mockCollection.getOne.mockResolvedValue(linkageBody({ type: 'orders', id: '99' }));

      const result = await port.resolvePolymorphicType(
        { collection: 'comments', id: [7], relation: 'commentable' },
        user,
      );

      expect(result).toEqual({ type: 'orders', id: '99' });
      // raw projection read on the source record, parsing done here in the adapter.
      expect(mockCollection.getOne).toHaveBeenCalledWith(
        [7],
        { fields: ['commentable@@@id'] },
        { skipDeserialization: true },
      );
    });

    it('passes composite ids through to the raw read', async () => {
      mockCollection.getOne.mockResolvedValue(linkageBody({ type: 'orders', id: '1|2' }));

      await port.resolvePolymorphicType(
        { collection: 'comments', id: ['tenant-1', 5], relation: 'commentable' },
        user,
      );

      expect(mockCollection.getOne).toHaveBeenCalledWith(
        ['tenant-1', 5],
        { fields: ['commentable@@@id'] },
        { skipDeserialization: true },
      );
    });

    it('returns null when the relation has no linkage', async () => {
      mockCollection.getOne.mockResolvedValue(linkageBody(null));

      const result = await port.resolvePolymorphicType(
        { collection: 'comments', id: [7], relation: 'commentable' },
        user,
      );

      expect(result).toBeNull();
    });

    it('wraps agent errors in AgentPortError', async () => {
      mockCollection.getOne.mockRejectedValue(new Error('boom'));

      await expect(
        port.resolvePolymorphicType(
          { collection: 'comments', id: [7], relation: 'commentable' },
          user,
        ),
      ).rejects.toThrow(AgentPortError);
    });
  });

  describe('probe', () => {
    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
      fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(jest.fn());
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('resolves when the agent returns 200 at GET /forest/', async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));

      await expect(port.probe()).resolves.toBeUndefined();

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3310/forest/',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('throws when the agent responds with 404 (wrong URL / not a Forest agent)', async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 404, statusText: 'Not Found' }));

      await expect(port.probe()).rejects.toThrow(AgentProbeError);
      await expect(port.probe()).rejects.toThrow(/404.*Not Found/);
    });

    it('throws when the agent responds with 401 (reverse proxy auth / wrong host)', async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 401, statusText: 'Unauthorized' }));

      await expect(port.probe()).rejects.toThrow(AgentProbeError);
      await expect(port.probe()).rejects.toThrow(/401.*Unauthorized/);
    });

    it('throws AgentProbeError with status when the agent responds with 5xx', async () => {
      fetchSpy.mockResolvedValue(
        new Response(null, { status: 503, statusText: 'Service Unavailable' }),
      );

      await expect(port.probe()).rejects.toThrow(AgentProbeError);
      await expect(port.probe()).rejects.toThrow(/503.*Service Unavailable/);
    });

    it('throws AgentProbeError with "cannot reach" when fetch throws and chains the cause', async () => {
      const underlying = new TypeError('fetch failed');
      fetchSpy.mockRejectedValue(underlying);

      await expect(port.probe()).rejects.toThrow(AgentProbeError);
      await expect(port.probe()).rejects.toThrow(/cannot reach.*fetch failed/);

      let caughtCause: unknown;

      try {
        await port.probe();
      } catch (error) {
        caughtCause = (error as AgentProbeError).cause;
      }

      expect(caughtCause).toBe(underlying);
    });

    it('throws AgentProbeError with "timeout" when fetch is aborted by the signal', async () => {
      const abortError = new Error('This operation was aborted');
      abortError.name = 'TimeoutError';
      fetchSpy.mockRejectedValue(abortError);

      await expect(port.probe()).rejects.toThrow(AgentProbeError);
      await expect(port.probe()).rejects.toThrow(/timeout after 5000ms/);
    });

    it('passes an AbortSignal with 5s timeout to fetch', async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));

      await port.probe();

      const fetchCall = fetchSpy.mock.calls[0];
      expect(fetchCall[1]?.signal).toBeInstanceOf(AbortSignal);
    });
  });
});
