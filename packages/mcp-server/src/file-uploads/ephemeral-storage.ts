import type { UploadStorage } from './types';
import type { Logger } from '../server';
import type { Request, Response, Router } from 'express';

import express from 'express';

interface StoredObject {
  body: Buffer;
  expiresAt: number;
}

// Issued keys are cheap next to a body — a few hundred bytes against up to maxBytes — but they
// outlive the request that asked for one, and nothing forces the caller to ever upload. This bounds
// them at about 2 MB, orders of magnitude beyond any real number of pending uploads.
const MAX_OUTSTANDING_KEYS = 10_000;

interface EphemeralOptions {
  maxBytes: number;
  maxTotalBytes: number;
  ttlSeconds: number;
  issuedTtlSeconds: number;
  publicBaseUrl: string;
}

/**
 * In-memory UploadStorage serving its own PUT endpoint on the MCP server's own origin, used when
 * `fileUploads` is enabled without a storage backend. Nothing to provision — and nothing shared:
 * objects live in this process only.
 *
 * The upload and the redemption are two separate requests, so behind several replicas, in cluster
 * mode, or on a serverless runtime one lands on an instance that never saw the other. Those
 * deployments need a real backend; this one is for a single instance.
 */
export default class EphemeralStorage implements UploadStorage {
  private readonly objects = new Map<string, StoredObject>();
  private readonly issued = new Map<string, number>();
  private storedBytes = 0;
  private inFlightBytes = 0;
  private options!: EphemeralOptions;
  private announced = false;

  constructor(private readonly logger: Logger) {}

  /** Separate from the constructor because the server only knows its own base url later. */
  configure(options: EphemeralOptions): void {
    this.options = options;
  }

  async createUploadUrl({ key }: { key: string }): Promise<{ url: string; method: string }> {
    const { publicBaseUrl, issuedTtlSeconds } = this.options;

    // Said here rather than at startup: uploads are on by default, so a boot-time warning would
    // reach every agent including those whose actions have no file field. This fires when the
    // feature is actually used, which is when the limitation starts to matter.
    if (!this.announced) {
      this.announced = true;
      this.logger(
        'Warn',
        '[fileUploads] no storage backend: uploaded files are held in memory, on this instance ' +
          'only. They are lost on restart, and a deployment with several replicas or a serverless ' +
          'runtime needs a real backend on the fileUploads option.',
      );
    }

    // Recorded so the endpoint only accepts keys it handed out. Without this, anything reaching the
    // origin could fill the store under keys of its own and deny the feature to everyone else.
    this.expire();

    // Insertion order, so this drops the least recent pending upload. Refusing to issue instead
    // would let one caller deny the feature to everyone; whoever is evicted gets a 404 telling
    // them to ask again.
    if (this.issued.size >= MAX_OUTSTANDING_KEYS) {
      const [oldest] = this.issued.keys();

      this.issued.delete(oldest);
      this.logger(
        'Warn',
        `[fileUploads] ${MAX_OUTSTANDING_KEYS} upload urls are outstanding: dropped ${oldest}, ` +
          'whose upload never came. Something is requesting destinations without uploading.',
      );
    }

    this.issued.set(key, Date.now() + issuedTtlSeconds * 1000);

    return {
      url: `${publicBaseUrl.replace(/\/+$/, '')}/${encodeURIComponent(key)}`,
      method: 'PUT',
    };
  }

  async download(key: string): Promise<Buffer> {
    const stored = this.read(key);

    if (!stored) {
      throw new Error(
        'not found in the in-memory store. Either the upload never completed — a refused one is ' +
          'answered with a 413 — or it expired after handleTtlSeconds, or it reached another ' +
          'instance: this store only holds what this instance received, so several replicas or a ' +
          'serverless runtime need a storage backend on the fileUploads option.',
      );
    }

    // Deliberately NOT dropped on read. executeAction downloads every reference before it sets
    // fields or runs, so any later failure — a mistyped field name, a throwing hook — would leave
    // the model retrying with handles whose objects are gone, told the upload failed when it did
    // not. expire() and maxTotalBytes reclaim instead. The upload url stays single-use; that is a
    // different property, enforced on the issued key.
    return stored.body;
  }

  async getSize(key: string): Promise<number | undefined> {
    return this.read(key)?.body.length;
  }

  createRouter(): Router {
    const router = express.Router();
    const { logger } = this;

    // The uploads route is mounted ahead of the request logger, which needs the body parsers this
    // one must precede, so each outcome is reported here instead.
    const refuse = (res: Response, key: string, status: number, reason: string) => {
      logger('Warn', `[fileUploads] refused ${key}: ${reason}`);
      res.status(status).json({ error: reason });
    };

    router.put('/:key', (req: Request, res: Response) => {
      const { key } = req.params;
      const { maxBytes, maxTotalBytes } = this.options;

      this.expire();

      // Consumed here rather than in write(): two concurrent PUTs for one key would both pass a
      // has() check and the later would silently overwrite the earlier. A failed attempt burns the
      // url too, which is the honest reading of single-use — retrying needs a fresh destination.
      if (!this.issued.delete(key)) {
        // An object still sitting here means the url was already used, which is the case an
        // integrator actually hits. Reported apart because "or it has expired" sends them looking
        // at ttls instead.
        if (this.objects.has(key)) {
          refuse(res, key, 409, 'this upload url was already used; request a fresh one');
        } else {
          refuse(
            res,
            key,
            404,
            'no upload was authorized for this key: it was never issued, already used, or ' +
              'expired — or it was issued by another instance, which cannot be seen from here',
          );
        }

        return;
      }

      // Answered before reading anything when the client declares a body that cannot fit.
      const declared = Number(req.headers['content-length']);

      if (Number.isFinite(declared) && declared > maxBytes) {
        refuse(res, key, 413, `the file is larger than the ${maxBytes} byte limit`);

        return;
      }

      // Dropped now rather than in write(): counting bytes this upload is about to replace would
      // refuse a replacement that fits, and keeping them until 'end' would hold both at once.
      this.forget(key);

      if (this.storedBytes + this.inFlightBytes >= maxTotalBytes) {
        refuse(res, key, 507, `the in-memory store is full (${maxTotalBytes} bytes)`);

        return;
      }

      const chunks: Uint8Array[] = [];
      let reserved = 0;
      let refused = '';

      // Reserved as the bytes arrive, not once the body is complete: concurrent uploads would
      // otherwise each weigh their own size against the same stale total and all be admitted.
      const release = () => {
        this.inFlightBytes -= reserved;
        reserved = 0;
      };

      req.on('data', chunk => {
        if (refused) return;

        const { length } = chunk as Uint8Array;

        if (reserved + length > maxBytes) {
          refused = `the file is larger than the ${maxBytes} byte limit`;
        } else if (this.storedBytes + this.inFlightBytes + length > maxTotalBytes) {
          refused = `the in-memory store is full (${maxTotalBytes} bytes)`;
        }

        if (refused) {
          // Kept reading, but no longer kept: destroying the socket or answering now would reach a
          // client that is still writing as a connection reset instead of a 413.
          chunks.length = 0;
          release();

          return;
        }

        reserved += length;
        this.inFlightBytes += length;
        chunks.push(chunk as Uint8Array);
      });

      req.on('end', () => {
        release();

        if (refused) {
          refuse(res, key, 413, refused);

          return;
        }

        // A throw here would be an uncaughtException and take the whole server down, not just this
        // request: Buffer.concat allocates and can fail under memory pressure.
        try {
          const body = Buffer.concat(chunks);

          this.write(key, body);
          logger('Debug', `[fileUploads] stored ${key} (${body.length} bytes)`);
          res.status(200).end();
        } catch (error) {
          logger('Error', `[fileUploads] could not store ${key}: ${(error as Error)?.message}`);
          res.status(500).json({ error: 'could not store the upload' });
        }
      });

      // An aborted upload never reaches 'end', so its reservation would leak and shrink the store
      // for good. Idempotent with the release above.
      req.on('close', release);

      // The path a client abort takes, which is the most common real failure here — silence would
      // leave a 20 MiB upload that vanished with no trace anywhere.
      req.on('error', (error: Error) => {
        logger(
          'Warn',
          `[fileUploads] upload of ${key} failed after ${reserved} bytes: ${error.message}`,
        );
        release();
        res.destroy();
      });
    });

    return router;
  }

  private write(key: string, body: Buffer): void {
    this.forget(key);
    this.objects.set(key, { body, expiresAt: Date.now() + this.options.ttlSeconds * 1000 });
    this.storedBytes += body.length;
  }

  private read(key: string): StoredObject | undefined {
    this.expire();

    return this.objects.get(key);
  }

  private forget(key: string): void {
    const stored = this.objects.get(key);

    if (stored) {
      this.objects.delete(key);
      this.storedBytes -= stored.body.length;
    }
  }

  private expire(): void {
    const now = Date.now();

    this.objects.forEach((stored, key) => {
      if (stored.expiresAt <= now) this.forget(key);
    });

    this.issued.forEach((expiresAt, key) => {
      if (expiresAt <= now) this.issued.delete(key);
    });
  }
}
