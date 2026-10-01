import toAgentTokenClaims from '../src/agent-token-claims';

describe('toAgentTokenClaims', () => {
  const user = {
    id: 7,
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    renderingId: 3,
    permissionLevel: 'admin',
    tags: { department: 'sales', region: 'emea' },
  };

  it('keeps the camelCase claims and adds their snake_case aliases', () => {
    expect(toAgentTokenClaims(user)).toMatchObject({
      id: 7,
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      renderingId: 3,
      permissionLevel: 'admin',
      first_name: 'Jane',
      last_name: 'Doe',
      permission_level: 'admin',
    });
  });

  it('signs rendering_id as a string', () => {
    expect(toAgentTokenClaims(user).rendering_id).toBe('3');
  });

  it('signs tags as a key/value array', () => {
    expect(toAgentTokenClaims(user).tags).toEqual([
      { key: 'department', value: 'sales' },
      { key: 'region', value: 'emea' },
    ]);
  });

  it('signs an empty array when the user has no tags', () => {
    expect(toAgentTokenClaims({ ...user, tags: {} }).tags).toEqual([]);
  });

  it('signs an empty array when the server sent no tags at all', () => {
    expect(toAgentTokenClaims({ ...user, tags: undefined }).tags).toEqual([]);
  });
});
