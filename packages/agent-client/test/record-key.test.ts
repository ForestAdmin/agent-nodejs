import recordKey, { groupByRecordKey, publishedRecordKeys } from '../src/record-key';

describe('recordKey', () => {
  it('should leave an already-clean name untouched', () => {
    expect(recordKey('email')).toBe('email');
  });

  it('should camelCase a snake_case name, since that is how the response carries it', () => {
    expect(recordKey('created_at')).toBe('createdAt');
  });

  it('should collapse every casing and separator variant onto one key, like the deserializer', () => {
    ['first_name', 'firstName', 'FirstName', 'first-name', 'FIRST_NAME'].forEach(name => {
      expect(recordKey(name)).toBe('firstName');
    });
  });

  it('should camelize non-ASCII names too, which a hand-rolled mirror would likely miss', () => {
    expect(recordKey('état_civil')).toBe('étatCivil');
  });
});

describe('groupByRecordKey', () => {
  it('should group the names that collapse onto one key', () => {
    expect(groupByRecordKey(['first_name', 'firstName', 'email'], name => name)).toEqual(
      new Map([
        ['firstName', ['first_name', 'firstName']],
        ['email', ['email']],
      ]),
    );
  });
});

describe('publishedRecordKeys', () => {
  it('should publish the camelCase key of a snake_case name', () => {
    expect(publishedRecordKeys(['created_at'])).toEqual(new Map([['created_at', 'createdAt']]));
  });

  it('should publish nothing for a name the deserializer leaves untouched', () => {
    expect(publishedRecordKeys(['email', 'createdAt', 'id'])).toEqual(new Map());
  });

  it('should publish nothing for names that collide on one key', () => {
    expect(publishedRecordKeys(['first_name', 'firstName'])).toEqual(new Map());
  });

  it('should publish Id for a Mongo _id', () => {
    expect(publishedRecordKeys(['_id'])).toEqual(new Map([['_id', 'Id']]));
  });

  it('should publish nothing for a name the resource id overwrites', () => {
    expect(publishedRecordKeys(['Id'])).toEqual(new Map());
  });

  it('should publish _id as Id while Id itself maps to the reserved id', () => {
    expect(publishedRecordKeys(['_id', 'Id'])).toEqual(new Map([['_id', 'Id']]));
  });

  it('should publish nothing for a name declared twice', () => {
    expect(publishedRecordKeys(['author_id', 'author_id'])).toEqual(new Map());
  });
});
