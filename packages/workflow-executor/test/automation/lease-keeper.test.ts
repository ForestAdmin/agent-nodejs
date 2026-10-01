import LeaseKeeper from '../../src/automation/lease-keeper';

describe('LeaseKeeper', () => {
  let keeper: LeaseKeeper;

  beforeEach(() => {
    keeper = new LeaseKeeper();
  });

  describe('record', () => {
    it.each([true, false])('should count a first beat answering held: %s as a change', held => {
      expect(keeper.record(held, 0)).toBe(true);
    });

    it.each([true, false])('should not count a second answer of held: %s as a change', held => {
      keeper.record(held, 0);

      expect(keeper.record(held, 15_000)).toBe(false);
    });

    it('should count a held lease that gets refused as a change', () => {
      keeper.record(true, 0);

      expect(keeper.record(false, 15_000)).toBe(true);
    });

    it('should count a refused lease that is held again as a change', () => {
      keeper.record(false, 0);

      expect(keeper.record(true, 15_000)).toBe(true);
    });
  });

  describe('isTrusted', () => {
    it('should never trust a lease before any beat', () => {
      expect(keeper.isTrusted(0)).toBe(false);
      expect(keeper.isTrusted(10_000)).toBe(false);
    });

    it('should trust a held lease for 30 s after its last confirmed beat', () => {
      keeper.record(true, 1_000);

      expect(keeper.isTrusted(1_000)).toBe(true);
      expect(keeper.isTrusted(30_999)).toBe(true);
      expect(keeper.isTrusted(31_000)).toBe(false);
    });

    it('should count the 30 s from the latest held beat', () => {
      keeper.record(true, 0);
      keeper.record(true, 15_000);

      expect(keeper.isTrusted(44_999)).toBe(true);
      expect(keeper.isTrusted(45_000)).toBe(false);
    });

    it('should not trust a refused lease, even right after a held beat', () => {
      keeper.record(true, 0);
      keeper.record(false, 1_000);

      expect(keeper.isTrusted(1_000)).toBe(false);
    });

    it('should not let a failed beat extend the confirmation', () => {
      keeper.record(true, 0);
      keeper.recordFailure(10_000);

      expect(keeper.isTrusted(29_999)).toBe(true);
      expect(keeper.isTrusted(30_000)).toBe(false);
    });
  });

  describe('recordFailure', () => {
    it('should keep trust when a beat fails within 30 s of the last confirmed one', () => {
      keeper.record(true, 0);

      expect(keeper.recordFailure(29_999)).toBe(false);
      expect(keeper.isTrusted(29_999)).toBe(true);
    });

    it('should lose trust when a beat fails 30 s after the last confirmed one', () => {
      keeper.record(true, 0);

      expect(keeper.recordFailure(30_000)).toBe(true);
      expect(keeper.isTrusted(30_000)).toBe(false);
    });

    it('should lose trust only once', () => {
      keeper.record(true, 0);
      keeper.recordFailure(30_000);

      expect(keeper.recordFailure(45_000)).toBe(false);
    });

    it('should count the next held beat after losing trust as a change', () => {
      keeper.record(true, 0);
      keeper.recordFailure(30_000);

      expect(keeper.record(true, 45_000)).toBe(true);
      expect(keeper.isTrusted(45_000)).toBe(true);
    });

    it('should have no trust to lose on a refused lease', () => {
      keeper.record(false, 0);

      expect(keeper.recordFailure(60_000)).toBe(false);
    });

    it('should have no trust to lose before any beat', () => {
      expect(keeper.recordFailure(60_000)).toBe(false);
    });
  });
});
