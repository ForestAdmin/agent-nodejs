import latestVersion from '../../src/services/latest-version';

describe('Services > Internal > latestVersion', () => {
  describe('When the package exists', () => {
    it('should return a valid version number', async () => {
      const version = await latestVersion('@forestadmin/agent');

      expect(version).toMatch(/^[0-9]+\.[0-9]+\.[0-9]+$/);
    }, 30_000);
  });

  describe('When the package does not exist', () => {
    it('should throw an error', async () => {
      await expect(latestVersion('@forestadmin/does-not-exist')).rejects.toThrow(
        'Error while retrieving the version:npm error code E404',
      );
    }, 30_000);
  });
});
