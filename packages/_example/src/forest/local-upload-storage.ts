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
export default function createLocalUploadStorage(
  port = Number(process.env.HTTP_PORT_UPLOAD_STORAGE ?? 3370),
): UploadStorage {
  const root = path.join(process.cwd(), '.upload-storage');
  const pathOf = (key: string) => path.join(root, key.replace(/[^\w./-]/g, '_'));

  const log = (message: string) => {
    // eslint-disable-next-line no-console
    console.log(`[local-upload-storage] ${message}`);
  };

  http
    .createServer((req, res) => {
      const key = decodeURIComponent((req.url ?? '/').replace(/^\/+/, ''));

      if (req.method !== 'PUT' || !key) {
        res.writeHead(405).end();

        return;
      }

      const chunks: Buffer[] = [];
      req.on('data', chunk => chunks.push(chunk as Buffer));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        const destination = pathOf(key);

        fs.mkdir(path.dirname(destination), { recursive: true })
          .then(() => fs.writeFile(destination, body))
          .then(() => {
            log(`stored ${key} (${body.length} bytes)`);
            res.writeHead(200).end();
          })
          .catch((error: Error) => {
            log(`failed to store ${key}: ${error.message}`);
            res.writeHead(500).end();
          });
      });
    })
    .listen(port, () => {
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
      // undefined means "not cheaply knowable": a missing object is download's job to reject.
      const stat = await fs.stat(pathOf(key)).catch(() => undefined);

      return stat?.size;
    },
  };
}
