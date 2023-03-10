describe('VersionManager', () => {
  beforeEach(() => jest.resetModules());

  it('should return "ObjectID" for mongoose 6', () => {
    jest.mock('mongoose', () => ({ version: '6.0.0' }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
    const VersionManager = require('../../src/utils/version-manager').default;
    expect(VersionManager.ObjectIdTypeName).toEqual('ObjectID');
  });

  it('should return "ObjectId" for mongoose 7', () => {
    jest.mock('mongoose', () => ({ version: '7.0.0' }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
    const VersionManager = require('../../src/utils/version-manager').default;

    expect(VersionManager.ObjectIdTypeName).toEqual('ObjectId');
  });
});
