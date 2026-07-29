import parseToolList from '../src/utils/parse-tool-list';

describe('parseToolList', () => {
  it('should return undefined when env value is undefined', () => {
    expect(parseToolList(undefined)).toBeUndefined();
  });

  it('should return undefined when env value is empty string', () => {
    expect(parseToolList('')).toBeUndefined();
  });

  it('should parse comma-separated tool names', () => {
    expect(parseToolList('create,update,delete')).toEqual(['create', 'update', 'delete']);
  });

  it('should trim whitespace around tool names', () => {
    expect(parseToolList(' create , update , delete ')).toEqual(['create', 'update', 'delete']);
  });

  it('should filter out empty entries from trailing commas', () => {
    expect(parseToolList('create,,delete,')).toEqual(['create', 'delete']);
  });

  it('should handle a single tool name', () => {
    expect(parseToolList('delete')).toEqual(['delete']);
  });
});
