import type { UploadStorage } from '@forestadmin/mcp-server';

import * as fs from 'fs/promises';
import * as http from 'http';
import * as path from 'path';

/**
 * Development-only UploadStorage: stores objects on disk and serves its own PUT endpoint, so the
 * MCP file upload flow can be exercised without a cloud bucket.
 *
 * It does not authenticate the PUT, so the unguessable key is the only thing protecting an
 * object. Fine on localhost, never in production — there, hand a real backend to `fileUploads`
 * and let it sign the upload URL (see the mcp-server README).
 */
// Slightly above the 20 MiB fileUploads default, so an oversized upload is reported by the
// server's own maxBytes check rather than masked by this one.
const MAX_BODY_BYTES = 25 * 1024 * 1024;

export default function createLocalUploadStorage(
  port = Number(process.env.HTTP_PORT_UPLOAD_STORAGE ?? 3370),
): UploadStorage {
  const root = path.join(process.cwd(), '.upload-storage');

  // The key of a PUT comes from the request URL, so it is caller-controlled. Sanitizing the
  // charset is not enough: '.' and '/' are legal in a key, and "../../etc/passwd" would resolve
  // outside root. Resolve first, then require containment.
  const pathOf = (key: string) => {
    const resolved = path.resolve(root, key.replace(/[^\w./-]/g, '_'));

    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new Error(`Key "${key}" resolves outside the storage root`);
    }

    return resolved;
  };

  const log = (message: string) => {
    // eslint-disable-next-line no-console
    console.log(`[local-upload-storage] ${message}`);
  };

  const server = http.createServer((req, res) => {
    const rawKey = (req.url ?? '/').replace(/^\/+/, '');

    if (req.method !== 'PUT' || !rawKey) {
      res.writeHead(405).end();

      return;
    }

    const chunks: Buffer[] = [];
    let received = 0;
    let refused = false;

    // Nothing authenticates this endpoint, so an unbounded body is a way to run the agent out of
    // memory. Refuse as soon as the limit is crossed instead of accumulating to the end.
    req.on('data', chunk => {
      if (refused) return;

      received += (chunk as Buffer).length;

      if (received > MAX_BODY_BYTES) {
        refused = true;
        log(`refused ${rawKey}: body exceeds ${MAX_BODY_BYTES} bytes`);
        res.writeHead(413).end();
        req.destroy();

        return;
      }

      chunks.push(chunk as Buffer);
    });

    req.on('end', () => {
      if (refused) return;

      const body = Buffer.concat(chunks);

      // Everything that can throw on a caller-controlled key runs inside this chain: both
      // decodeURIComponent, which raises URIError on a lone '%', and pathOf, which rejects a key
      // escaping the root. A throw in this listener would be an uncaughtException and take the
      // whole agent down instead of failing one request.
      Promise.resolve()
        .then(async () => {
          const destination = pathOf(decodeURIComponent(rawKey));
          await fs.mkdir(path.dirname(destination), { recursive: true });
          await fs.writeFile(destination, body);
        })
        .then(() => {
          log(`stored ${rawKey} (${body.length} bytes)`);
          res.writeHead(200).end();
        })
        .catch((error: Error) => {
          log(`refused ${rawKey}: ${error.message}`);
          res.writeHead(400).end();
        });
    });

    req.on('error', (error: Error) => log(`request failed: ${error.message}`));
  });

  server.on('error', (error: Error) => {
    log(`cannot listen on ${port}: ${error.message}. Set HTTP_PORT_UPLOAD_STORAGE.`);
  });

  server.listen(port, () => {
    log(`PUT endpoint on http://localhost:${port}, objects under ${root}`);
  });

  return {
    async createUploadUrl({ key }) {
      return { url: `http://localhost:${port}/${encodeURIComponent(key)}`, method: 'PUT' };
    },
    async download(key) {
      return fs.readFile(pathOf(key));
    },
    async getSize(key) {
      const stat = await fs.stat(pathOf(key)).catch(() => undefined);

      return stat?.size;
    },
  };
}
