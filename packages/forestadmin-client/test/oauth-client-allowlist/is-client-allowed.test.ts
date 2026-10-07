import isClientAllowed from '../../src/oauth-client-allowlist/is-client-allowed';

describe('isClientAllowed', () => {
  it('should allow a client whose every redirect URI is on an allowed domain', () => {
    expect(isClientAllowed(['https://dust.tt/oauth/finalize'], ['dust.tt'])).toBe(true);
  });

  it('should allow redirect URIs on subdomains of an allowed domain', () => {
    expect(
      isClientAllowed(['https://eu.dust.tt/cb', 'https://mcp.front.eu.dust.tt/cb'], ['dust.tt']),
    ).toBe(true);
  });

  it('should allow a client matched by any of several domains', () => {
    expect(isClientAllowed(['https://claude.ai/cb'], ['dust.tt', 'claude.ai'])).toBe(true);
  });

  it('should match case-insensitively', () => {
    expect(isClientAllowed(['https://EU.Dust.TT/cb'], ['DUST.tt'])).toBe(true);
  });

  it('should allow plain http redirect URIs on an allowed domain', () => {
    expect(isClientAllowed(['http://dust.tt/cb'], ['dust.tt'])).toBe(true);
  });

  it('should reject a client having one redirect URI outside the allowed domains', () => {
    expect(isClientAllowed(['https://dust.tt/cb', 'https://evil.example/cb'], ['dust.tt'])).toBe(
      false,
    );
  });

  it('should reject a lookalike domain that merely ends with an allowed domain', () => {
    expect(isClientAllowed(['https://evil-dust.tt/cb'], ['dust.tt'])).toBe(false);
  });

  it('should reject a sibling domain that only shares a split top-level domain', () => {
    expect(isClientAllowed(['https://othervendor.co.uk/cb'], ['myvendor.co.uk'])).toBe(false);
  });

  it('should reject a custom-scheme redirect URI whose hostname is on an allowed domain', () => {
    expect(isClientAllowed(['attacker-app://dust.tt/cb'], ['dust.tt'])).toBe(false);
  });

  it('should reject userinfo pointing at an allowed domain', () => {
    expect(isClientAllowed(['https://dust.tt@evil.example/cb'], ['dust.tt'])).toBe(false);
  });

  it('should reject an empty redirect URI list', () => {
    expect(isClientAllowed([], ['dust.tt'])).toBe(false);
  });

  it('should reject missing redirect URIs', () => {
    expect(isClientAllowed(undefined, ['dust.tt'])).toBe(false);
  });

  it('should reject an unparseable redirect URI', () => {
    expect(isClientAllowed(['not-a-valid-url'], ['dust.tt'])).toBe(false);
  });

  it('should reject the zendesk app redirect URI when only claude.ai is allowed', () => {
    expect(
      isClientAllowed(['https://app.forestadmin.com/zendesk-oauth-redirect'], ['claude.ai']),
    ).toBe(false);
  });
});
