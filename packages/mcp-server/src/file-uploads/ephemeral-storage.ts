import type { UploadStorage } from './types';
import type { Logger } from '../server';
import type { Request, Response, Router } from 'express';

import express from 'express';

interface StoredObject {
  body: Buffer;
  expiresAt: number;
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
  private storedBytes = 0;
  private maxBytes = 0;
  private maxTotalBytes = 0;
  private ttlSeconds = 0;
  private publicBaseUrl = '';

  /** Called once the server knows its own base url, which the constructor cannot yet. */
  configure(options: {
    maxBytes: number;
    maxTotalBytes: number;
    ttlSeconds: number;
    publicBaseUrl: string;
  }): void {
    this.maxBytes = options.maxBytes;
    this.maxTotalBytes = options.maxTotalBytes;
    this.ttlSeconds = options.ttlSeconds;
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/+$/, '');
  }

  async createUploadUrl({ key }: { key: string }): Promise<{ url: string; method: string }> {
    return { url: `${this.publicBaseUrl}/${encodeURIComponent(key)}`, method: 'PUT' };
  }

  async download(key: string): Promise<Buffer> {
    const stored = this.read(key);

    if (!stored) {
      throw new Error(
        'not found in the in-memory store. It only holds objects for the instance that received ' +
          'the upload: behind several replicas or on a serverless runtime, configure a storage ' +
          'backend on the fileUploads option.',
      );
    }

    return stored.body;
  }

  async getSize(key: string): Promise<number | undefined> {
    return this.read(key)?.body.length;
  }

  createRouter(logger: Logger): Router {
    const router = express.Router();

    router.put('/:key', (req: Request, res: Response) => {
      const { key } = req.params;

      this.evictExpired();

      // Refused before reading a single chunk when the store has no room at all, rather than
      // accumulating a body only to drop it.
      if (this.storedBytes >= this.maxTotalBytes) {
        logger('Warn', `[fileUploads] refused ${key}: the in-memory store is full`);
        res.status(507).end();

        return;
      }

      const chunks: Uint8Array[] = [];
      let received = 0;
      let refused = false;

      req.on('data', chunk => {
        if (refused) return;

        received += (chunk as Uint8Array).length;

        if (received > this.maxBytes || this.storedBytes + received > this.maxTotalBytes) {
          // Stop keeping the bytes, but keep reading them and answer at the end. Destroying the
          // socket or answering now would reach the client as a connection reset instead of a 413,
          // since it is still writing. Nothing accumulates either way.
          refused = true;
          chunks.length = 0;
          logger('Warn', `[fileUploads] refused ${key}: over the in-memory store limits`);
        } else {
          chunks.push(chunk as Uint8Array);
        }
      });

      req.on('end', () => {
        if (refused) {
          res.status(413).end();

          return;
        }

        this.write(key, Buffer.concat(chunks));
        res.status(200).end();
      });

      req.on('error', () => res.destroy());
    });

    return router;
  }

  private write(key: string, body: Buffer): void {
    this.storedBytes -= this.objects.get(key)?.body.length ?? 0;
    this.objects.set(key, { body, expiresAt: Date.now() + this.ttlSeconds * 1000 });
    this.storedBytes += body.length;
  }

  private read(key: string): StoredObject | undefined {
    this.evictExpired();

    return this.objects.get(key);
  }

  private evictExpired(): void {
    const now = Date.now();

    this.objects.forEach((stored, key) => {
      if (stored.expiresAt <= now) {
        this.objects.delete(key);
        this.storedBytes -= stored.body.length;
      }
    });
  }
}
