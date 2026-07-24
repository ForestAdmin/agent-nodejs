import normalizeAgentUrl from '../../src/utils/normalize-agent-url';

describe('normalizeAgentUrl', () => {
  it.each([undefined, ''])('returns undefined for %p', input => {
    expect(normalizeAgentUrl(input)).toBeUndefined();
  });

  it.each([
    ['http://forest-agent.internal:3310', 'http://forest-agent.internal:3310'],
    ['https://forest-agent.internal', 'https://forest-agent.internal'],
  ])('accepts %p and returns it unchanged', (input, expected) => {
    expect(normalizeAgentUrl(input)).toBe(expected);
  });

  it('preserves a base path and strips a trailing slash', () => {
    expect(normalizeAgentUrl('http://internal:3310/backend/')).toBe('http://internal:3310/backend');
  });

  it.each([
    'not-a-url',
    'ftp://internal:3310',
    'http://internal:3310?x=1',
    'http://internal:3310/#frag',
  ])('throws for %p', input => {
    expect(() => normalizeAgentUrl(input)).toThrow(/Invalid agentUrl/);
  });
});
