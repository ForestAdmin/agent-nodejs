import type { UploadStorage } from './types';
import type { Logger } from '../server';
import type { Request, Response, Router } from 'express';

import express from 'express';

interface StoredObject {
  body: Buffer;
  expiresAt: number;
}

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

  /** Separate from the constructor because the server only knows its own base url later. */
  configure(options: EphemeralOptions): void {
    this.options = options;
  }

  async createUploadUrl({ key }: { key: string }): Promise<{ url: string; method: string }> {
    const { publicBaseUrl, issuedTtlSeconds } = this.options;

    // Recorded so the endpoint only accepts keys it handed out. Without this, anything reaching the
    // origin could fill the store under keys of its own and deny the feature to everyone else.
    this.expire();
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

    // Dropped on read: the store is small, and keeping consumed objects until their ttl would let
    // a handful of redeemed uploads fill it. A handle is single-use against this backend.
    this.forget(key);

    return stored.body;
  }

  async getSize(key: string): Promise<number | undefined> {
    return this.read(key)?.body.length;
  }

  createRouter(logger: Logger): Router {
    const router = express.Router();

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

      if (!this.issued.has(key)) {
        refuse(res, key, 404, 'no upload was authorized for this key, or it has expired');

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
    this.issued.delete(key);
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
