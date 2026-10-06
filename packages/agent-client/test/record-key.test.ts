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
    expect(publishedRecordKeys(['created_at'])).toEqual(
      new Map([['created_at', { recordKey: 'createdAt' }]]),
    );
  });

  it('should publish nothing for a name the deserializer leaves untouched', () => {
    expect(publishedRecordKeys(['email', 'createdAt', 'id'])).toEqual(new Map());
  });

  it('should publish the shared key and the other names for names that collide on one key', () => {
    expect(publishedRecordKeys(['first_name', 'firstName'])).toEqual(
      new Map([
        ['first_name', { recordKey: 'firstName', sharesRecordKeyWith: ['firstName'] }],
        ['firstName', { recordKey: 'firstName', sharesRecordKeyWith: ['first_name'] }],
      ]),
    );
  });

  it('should list every other colliding name when more than two collide', () => {
    expect(publishedRecordKeys(['first_name', 'firstName', 'FirstName']).get('firstName')).toEqual({
      recordKey: 'firstName',
      sharesRecordKeyWith: ['first_name', 'FirstName'],
    });
  });

  it('should publish Id for a Mongo _id', () => {
    expect(publishedRecordKeys(['_id'])).toEqual(new Map([['_id', { recordKey: 'Id' }]]));
  });

  it('should publish a null key for a name the resource id overwrites', () => {
    expect(publishedRecordKeys(['Id'])).toEqual(new Map([['Id', { recordKey: null }]]));
  });

  it('should publish _id as Id while Id itself gets a null key', () => {
    expect(publishedRecordKeys(['_id', 'Id'])).toEqual(
      new Map([
        ['_id', { recordKey: 'Id' }],
        ['Id', { recordKey: null }],
      ]),
    );
  });

  it('should publish a null key without shared names when several names collapse onto id', () => {
    expect(publishedRecordKeys(['id', 'Id', 'ID'])).toEqual(
      new Map([
        ['Id', { recordKey: null }],
        ['ID', { recordKey: null }],
      ]),
    );
  });

  it('should treat a name declared twice as one field, not a collision', () => {
    expect(publishedRecordKeys(['author_id', 'author_id'])).toEqual(
      new Map([['author_id', { recordKey: 'authorId' }]]),
    );
  });
});
