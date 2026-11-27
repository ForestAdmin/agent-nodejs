import agentSchemaOf from '../../src/schema/agent-schema';

describe('agentSchemaOf', () => {
  it('should read the same schema once for the same collections', () => {
    const collections = [{ name: 'users', actions: [] }];

    expect(agentSchemaOf(collections)).toBe(agentSchemaOf(collections));
    expect(agentSchemaOf(collections)).not.toBe(agentSchemaOf([...collections]));
  });

  it('should keep only the actions an agent can run', () => {
    const schema = agentSchemaOf([
      {
        name: 'users',
        actions: [
          { id: 'users-ban', name: 'Ban', endpoint: '/forest/_actions/users/0/ban' },
          { id: 'users-draft', name: 'Draft', endpoint: '' },
        ],
      },
    ]);

    expect(Object.keys(schema.collection('users').actions)).toEqual(['Ban']);
  });
});
