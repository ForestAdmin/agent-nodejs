import normalizeDomainList from '../../src/utils/normalize-domain-list';

describe('normalizeDomainList', () => {
  it('should return undefined when the option is not configured', () => {
    expect(normalizeDomainList(undefined)).toBeUndefined();
  });

  it('should return bare domains unchanged', () => {
    expect(normalizeDomainList(['dust.tt', 'claude.ai'])).toEqual(['dust.tt', 'claude.ai']);
  });

  it('should trim entries and drop blank ones among valid domains', () => {
    expect(normalizeDomainList([' dust.tt ', '  ', ''])).toEqual(['dust.tt']);
  });

  it('should lowercase entries', () => {
    expect(normalizeDomainList(['DUST.tt'])).toEqual(['dust.tt']);
  });

  it('should punycode-normalize unicode entries to match URL hostnames', () => {
    expect(normalizeDomainList(['bücher.de'])).toEqual(['xn--bcher-kva.de']);
  });

  it('should throw on an empty list', () => {
    expect(() => normalizeDomainList([])).toThrow(/allowedOAuthClients/);
  });

  it('should throw when every entry is blank', () => {
    expect(() => normalizeDomainList(['  ', ''])).toThrow(/allowedOAuthClients/);
  });

  it('should throw on an entry carrying a scheme', () => {
    expect(() => normalizeDomainList(['https://dust.tt'])).toThrow(/bare domains/);
  });

  it('should throw on an entry carrying a port', () => {
    expect(() => normalizeDomainList(['dust.tt:443'])).toThrow(/bare domains/);
  });

  it('should throw on an entry containing whitespace', () => {
    expect(() => normalizeDomainList(['dust tt'])).toThrow(/bare domains/);
  });

  it('should throw on url-delimiter characters instead of normalizing to the wrong domain', () => {
    expect(() => normalizeDomainList(['approved.example@attacker.example'])).toThrow(
      /bare domains/,
    );
    expect(() => normalizeDomainList(['dust.tt?x'])).toThrow(/bare domains/);
    expect(() => normalizeDomainList(['dust.tt#x'])).toThrow(/bare domains/);
  });
});
