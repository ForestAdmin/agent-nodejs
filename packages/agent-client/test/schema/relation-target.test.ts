import relationTargetOf from '../../src/schema/relation-target';

describe('relationTargetOf', () => {
  it('should read the target collection of a reference', () => {
    expect(relationTargetOf({ reference: 'users.id' })).toEqual({
      polymorphic: false,
      target: 'users',
    });
  });

  it('should keep the dots of a nested collection name', () => {
    expect(relationTargetOf({ reference: 'User.address.id' })).toEqual({
      polymorphic: false,
      target: 'User.address',
    });
  });

  it('should read the whole reference as the target when it names no key', () => {
    expect(relationTargetOf({ reference: 'users' })).toEqual({
      polymorphic: false,
      target: 'users',
    });
  });

  it('should list the targets of a polymorphic relation', () => {
    expect(
      relationTargetOf({
        reference: 'commentable.id',
        polymorphicReferencedModels: ['posts', 'videos'],
      }),
    ).toEqual({ polymorphic: true, targets: ['posts', 'videos'] });
  });

  it('should answer null without reference', () => {
    expect(relationTargetOf({ reference: null })).toBeNull();
  });
});
