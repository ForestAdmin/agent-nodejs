import parseDomainList from '../../src/utils/parse-domain-list';

describe('parseDomainList', () => {
  it('should return undefined when env value is undefined', () => {
    expect(parseDomainList(undefined)).toBeUndefined();
  });

  it('should return undefined when env value is empty string', () => {
    expect(parseDomainList('')).toBeUndefined();
  });

  it('should return undefined when env value contains no domains, only separators', () => {
    expect(parseDomainList(' , ,')).toBeUndefined();
  });

  it('should parse comma-separated domains', () => {
    expect(parseDomainList('dust.tt,claude.ai')).toEqual(['dust.tt', 'claude.ai']);
  });

  it('should trim whitespace around domains', () => {
    expect(parseDomainList(' dust.tt , claude.ai ')).toEqual(['dust.tt', 'claude.ai']);
  });

  it('should filter out empty entries from repeated or trailing commas', () => {
    expect(parseDomainList('dust.tt,,claude.ai,')).toEqual(['dust.tt', 'claude.ai']);
  });

  it('should handle a single domain', () => {
    expect(parseDomainList('dust.tt')).toEqual(['dust.tt']);
  });

  it('should pass subdomain entries through verbatim', () => {
    expect(parseDomainList('eu.dust.tt,mcp.front.eu.dust.tt')).toEqual([
      'eu.dust.tt',
      'mcp.front.eu.dust.tt',
    ]);
  });
});
