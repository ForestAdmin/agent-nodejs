import LeaseKeeper from '../../src/automation/lease-keeper';

describe('LeaseKeeper', () => {
  let keeper: LeaseKeeper;

  beforeEach(() => {
    keeper = new LeaseKeeper();
  });

  describe('recordBeat', () => {
    it.each([true, false])('should count a first beat answering held: %s as a change', held => {
      expect(keeper.recordBeat(held, 0)).toStrictEqual({ roleChanged: true });
    });

    it.each([true, false])('should not count a second answer of held: %s as a change', held => {
      keeper.recordBeat(held, 0);

      expect(keeper.recordBeat(held, 15_000)).toStrictEqual({ roleChanged: false });
    });

    it('should count a held lease that gets refused as a change', () => {
      keeper.recordBeat(true, 0);

      expect(keeper.recordBeat(false, 15_000)).toStrictEqual({ roleChanged: true });
    });

    it('should count a refused lease that is held again as a change', () => {
      keeper.recordBeat(false, 0);

      expect(keeper.recordBeat(true, 15_000)).toStrictEqual({ roleChanged: true });
    });
  });

  describe('isTrusted', () => {
    it('should never trust a lease before any beat', () => {
      expect(keeper.isTrusted(0)).toBe(false);
      expect(keeper.isTrusted(10_000)).toBe(false);
    });

    it('should trust a held lease for 30 s after its last confirmed beat', () => {
      keeper.recordBeat(true, 1_000);

      expect(keeper.isTrusted(1_000)).toBe(true);
      expect(keeper.isTrusted(30_999)).toBe(true);
      expect(keeper.isTrusted(31_000)).toBe(false);
    });

    it('should count the 30 s from the latest held beat', () => {
      keeper.recordBeat(true, 0);
      keeper.recordBeat(true, 15_000);

      expect(keeper.isTrusted(44_999)).toBe(true);
      expect(keeper.isTrusted(45_000)).toBe(false);
    });

    it('should not trust a refused lease, even right after a held beat', () => {
      keeper.recordBeat(true, 0);
      keeper.recordBeat(false, 1_000);

      expect(keeper.isTrusted(1_000)).toBe(false);
    });

    it('should not let a failed beat extend the confirmation', () => {
      keeper.recordBeat(true, 0);
      keeper.recordFailedBeat(10_000);

      expect(keeper.isTrusted(29_999)).toBe(true);
      expect(keeper.isTrusted(30_000)).toBe(false);
    });
  });

  describe('recordFailedBeat', () => {
    it('should keep trust when a beat fails within 30 s of the last confirmed one', () => {
      keeper.recordBeat(true, 0);

      expect(keeper.recordFailedBeat(29_999)).toStrictEqual({ trustLost: false });
      expect(keeper.isTrusted(29_999)).toBe(true);
    });

    it('should lose trust when a beat fails 30 s after the last confirmed one', () => {
      keeper.recordBeat(true, 0);

      expect(keeper.recordFailedBeat(30_000)).toStrictEqual({ trustLost: true });
      expect(keeper.isTrusted(30_000)).toBe(false);
    });

    it('should lose trust only once', () => {
      keeper.recordBeat(true, 0);
      keeper.recordFailedBeat(30_000);

      expect(keeper.recordFailedBeat(45_000)).toStrictEqual({ trustLost: false });
    });

    it('should count the next held beat after losing trust as a change', () => {
      keeper.recordBeat(true, 0);
      keeper.recordFailedBeat(30_000);

      expect(keeper.recordBeat(true, 45_000)).toStrictEqual({ roleChanged: true });
      expect(keeper.isTrusted(45_000)).toBe(true);
    });

    it('should have no trust to lose on a refused lease', () => {
      keeper.recordBeat(false, 0);

      expect(keeper.recordFailedBeat(60_000)).toStrictEqual({ trustLost: false });
    });

    it('should have no trust to lose before any beat', () => {
      expect(keeper.recordFailedBeat(60_000)).toStrictEqual({ trustLost: false });
    });
  });
});
