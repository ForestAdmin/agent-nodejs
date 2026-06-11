import { BearerClaimsSchema } from '../../src/http/bearer-claims';

describe('BearerClaimsSchema', () => {
  it('accepts a payload with a numeric id', () => {
    const result = BearerClaimsSchema.safeParse({ id: 1 });

    expect(result.success).toBe(true);
  });

  it('tolerates standard JWT claims and extra Forest claims (not strict)', () => {
    // jsonwebtoken adds iat/exp to the decoded payload — a strict schema would wrongly reject it.
    const result = BearerClaimsSchema.safeParse({
      id: 1,
      iat: 1_700_000_000,
      exp: 1_700_003_600,
      email: 'admin@forest.com',
      role: 'admin',
    });

    expect(result.success).toBe(true);
  });

  it.each([
    ['no id', { email: 'no-id@forest.com' }],
    ['non-numeric id', { id: 'user-42' }],
    ['null id', { id: null }],
    ['empty payload', {}],
  ])('rejects a payload with %s', (_, payload) => {
    expect(BearerClaimsSchema.safeParse(payload).success).toBe(false);
  });
});
