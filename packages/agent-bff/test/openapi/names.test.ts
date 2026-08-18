import createNamer, { sanitizeIdentifier } from '../../src/openapi/names';

describe('sanitizeIdentifier', () => {
  it.each([
    ['Mark as paid', 'Mark_as_paid'],
    ['Mark as paid/done', 'Mark_as_paid_done'],
    ['User.address', 'User_address'],
    ['clôturé', 'cl_tur_'],
  ])('should turn %s into a URL-safe identifier', (raw, expected) => {
    expect(sanitizeIdentifier(raw)).toBe(expected);
  });

  it('should never return an empty identifier, which is not a usable method name', () => {
    expect(sanitizeIdentifier('')).toBe('_');
    expect(sanitizeIdentifier('///')).toBe('___');
  });
});

describe('createNamer', () => {
  it('should hand out the sanitized name when nothing claimed it', () => {
    const namer = createNamer();

    expect(namer('users')).toBe('users');
    expect(namer('orders')).toBe('orders');
  });

  it('should suffix the names that collapse onto an already claimed one', () => {
    const namer = createNamer();

    expect(namer('Mark as paid')).toBe('Mark_as_paid');
    expect(namer('Mark-as-paid')).toBe('Mark_as_paid_2');
    expect(namer('Mark.as.paid')).toBe('Mark_as_paid_3');
  });

  it('should keep two namers independent, so one family cannot rename another', () => {
    const collections = createNamer();
    const actions = createNamer();

    expect(collections('users')).toBe('users');
    expect(actions('users')).toBe('users');
  });
});
