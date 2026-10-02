// Past this without a confirmed beat, the lease may have expired and gone to another instance.
// Judged at each dispatch rather than when a beat fails: a timed-out beat only fails 5 s late, and
// the next one 15 s after that, which would land past the 45 s lease.
const LEASE_TRUSTED_FOR_MS = 30_000;

export default class LeaseKeeper {
  private holdsLease: boolean | undefined;
  private leaseConfirmedAt = 0;

  recordBeat(held: boolean, now: number): { roleChanged: boolean } {
    const roleChanged = held !== this.holdsLease;
    this.holdsLease = held;

    if (held) this.leaseConfirmedAt = now;

    return { roleChanged };
  }

  recordFailedBeat(now: number): { trustLost: boolean } {
    if (!this.holdsLease || now - this.leaseConfirmedAt < LEASE_TRUSTED_FOR_MS) {
      return { trustLost: false };
    }

    this.holdsLease = false;

    return { trustLost: true };
  }

  isTrusted(now: number): boolean {
    return this.holdsLease === true && now - this.leaseConfirmedAt < LEASE_TRUSTED_FOR_MS;
  }
}
