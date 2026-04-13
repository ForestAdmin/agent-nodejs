import parseDisabledTools from '../src/utils/parse-disabled-tools';

describe('parseDisabledTools', () => {
  it('should return undefined when env value is undefined', () => {
    expect(parseDisabledTools(undefined)).toBeUndefined();
  });

  it('should return undefined when env value is empty string', () => {
    expect(parseDisabledTools('')).toBeUndefined();
  });

  it('should parse comma-separated tool names', () => {
    expect(parseDisabledTools('create,update,delete')).toEqual(['create', 'update', 'delete']);
  });

  it('should trim whitespace around tool names', () => {
    expect(parseDisabledTools(' create , update , delete ')).toEqual([
      'create',
      'update',
      'delete',
    ]);
  });

  it('should filter out empty entries from trailing commas', () => {
    expect(parseDisabledTools('create,,delete,')).toEqual(['create', 'delete']);
  });

  it('should handle a single tool name', () => {
    expect(parseDisabledTools('delete')).toEqual(['delete']);
  });
});
