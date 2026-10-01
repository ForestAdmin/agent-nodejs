// Past this without a confirmed beat, the lease may have expired and gone to another instance.
// Judged at each dispatch rather than when a beat fails: a timed-out beat only fails 5 s late, and
// the next one 15 s after that, which would land past the 45 s lease.
const LEASE_TRUSTED_FOR_MS = 30_000;

export default class LeaseKeeper {
  private holdsLease: boolean | undefined;
  private leaseConfirmedAt = 0;

  /** Returns whether this beat changed who sweeps. */
  record(held: boolean, now: number): boolean {
    const changed = held !== this.holdsLease;
    this.holdsLease = held;

    if (held) this.leaseConfirmedAt = now;

    return changed;
  }

  /** Returns whether the failed beat made the lease untrusted, so this instance stands by. */
  recordFailure(now: number): boolean {
    if (!this.holdsLease || now - this.leaseConfirmedAt < LEASE_TRUSTED_FOR_MS) return false;

    this.holdsLease = false;

    return true;
  }

  isTrusted(now: number): boolean {
    return this.holdsLease === true && now - this.leaseConfirmedAt < LEASE_TRUSTED_FOR_MS;
  }
}
