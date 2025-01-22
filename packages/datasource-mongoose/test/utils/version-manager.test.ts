describe('VersionManager', () => {
  beforeEach(() => jest.resetModules());

  it('should dynamically return type name for current mongoose version', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
    const VersionManager = require('../../src/utils/version-manager').default;

    expect(VersionManager.ObjectIdTypeName).toEqual('ObjectId');
  });
});
