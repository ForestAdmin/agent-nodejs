import createEnvironmentIdResolver from '../../src/oauth/environment-id';

describe('createEnvironmentIdResolver', () => {
  describe('when the fetch succeeds', () => {
    it('should fetch once and serve the cached id afterwards', async () => {
      const fetchEnvironmentId = jest.fn().mockResolvedValue(42);
      const resolve = createEnvironmentIdResolver({ fetchEnvironmentId });

      await expect(resolve()).resolves.toBe(42);
      await expect(resolve()).resolves.toBe(42);

      expect(fetchEnvironmentId).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the fetch fails', () => {
    it('should reject and resolve on a later call, since the failure is not cached', async () => {
      const fetchEnvironmentId = jest
        .fn()
        .mockRejectedValueOnce(new Error('forest server unreachable'))
        .mockResolvedValue(7);
      const resolve = createEnvironmentIdResolver({ fetchEnvironmentId });

      await expect(resolve()).rejects.toThrow('forest server unreachable');
      await expect(resolve()).resolves.toBe(7);

      expect(fetchEnvironmentId).toHaveBeenCalledTimes(2);
    });
  });

  describe('when two callers arrive before the first fetch settles', () => {
    it('should share a single fetch', async () => {
      const fetchEnvironmentId = jest.fn().mockResolvedValue(1);
      const resolve = createEnvironmentIdResolver({ fetchEnvironmentId });

      await expect(Promise.all([resolve(), resolve()])).resolves.toEqual([1, 1]);

      expect(fetchEnvironmentId).toHaveBeenCalledTimes(1);
    });
  });
});
