import { WriteStream } from 'fs';
import { Deserializer } from 'jsonapi-serializer';
import superagent from 'superagent';

export default class HttpRequester {
  private readonly deserializer: Deserializer;

  private get baseUrl() {
    const prefix = this.options.prefix ? `/${this.options.prefix}` : '';

    return `${this.options.url}${prefix}`;
  }

  constructor(
    private readonly token: string,
    private readonly options: { prefix?: string; url: string },
  ) {
    this.deserializer = new Deserializer({ keyForAttribute: 'camelCase' });
  }

  async query<Data = unknown>({
    method,
    path,
    body,
    query,
    maxTimeAllowed,
    contentType,
  }: {
    method: 'get' | 'post' | 'put' | 'delete';
    path: string;
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    maxTimeAllowed?: number;
    contentType?: 'application/json' | 'text/csv';
  }): Promise<Data> {
    try {
      const url = new URL(`${this.baseUrl}${HttpRequester.escapeUrlSlug(path)}`).toString();

      const req = superagent[method](url)
        .timeout(maxTimeAllowed ?? 10_000)
        .set('Authorization', `Bearer ${this.token}`)
        .set('Content-Type', contentType ?? 'application/json')
        .query({ timezone: 'Europe/Paris', ...query });

      if (body) req.send(body);

      const response = await req;

      try {
        return (await this.deserializer.deserialize(response.body)) as Data;
      } catch {
        return (response.body ?? response.text) as Data;
      }
    } catch (error: any) {
      if (!error.response) throw error;
      throw new Error(
        JSON.stringify({ error: error.response.error as Record<string, string>, body }, null, 4),
      );
    }
  }

  /**
   * Execute a request that may return either JSON or a file (binary data).
   * Returns the response with additional metadata to determine the response type.
   */
  async queryWithFileSupport<Data = unknown>({
    method,
    path,
    body,
    query,
    maxTimeAllowed,
  }: {
    method: 'get' | 'post' | 'put' | 'delete';
    path: string;
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    maxTimeAllowed?: number;
  }): Promise<
    | { type: 'json'; data: Data }
    | { type: 'file'; buffer: Buffer; mimeType: string; fileName: string }
  > {
    try {
      const url = new URL(`${this.baseUrl}${HttpRequester.escapeUrlSlug(path)}`).toString();

      const req = superagent[method](url)
        .timeout(maxTimeAllowed ?? 10_000)
        .responseType('arraybuffer') // Get raw buffer for any response
        .set('Authorization', `Bearer ${this.token}`)
        .set('Content-Type', 'application/json')
        .query({ timezone: 'Europe/Paris', ...query });

      if (body) req.send(body);

      const response = await req;

      const contentType = response.headers['content-type'] || '';
      const contentDisposition = response.headers['content-disposition'] || '';

      // Check if this is a file download (non-JSON content type with attachment)
      const isFile =
        contentDisposition.includes('attachment') ||
        (!contentType.includes('application/json') && !contentType.includes('text/'));

      if (isFile) {
        // Extract filename from Content-Disposition header
        // Format: attachment; filename="report.pdf" or attachment; filename=report.pdf
        const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        let fileName = 'download';

        if (fileNameMatch && fileNameMatch[1]) {
          fileName = fileNameMatch[1].replace(/['"]/g, '');
        }

        return {
          type: 'file',
          buffer: Buffer.from(response.body),
          mimeType: contentType.split(';')[0].trim(),
          fileName,
        };
      }

      // Parse as JSON
      const jsonString = Buffer.from(response.body).toString('utf-8');
      const jsonBody = JSON.parse(jsonString);

      try {
        return { type: 'json', data: (await this.deserializer.deserialize(jsonBody)) as Data };
      } catch (deserializationError) {
        // Log the failure - this is important for debugging schema mismatches
        console.warn(
          `[HttpRequester] Failed to deserialize JSON:API response, returning raw JSON. ` +
            `Error: ${
              deserializationError instanceof Error
                ? deserializationError.message
                : String(deserializationError)
            }`,
        );

        return { type: 'json', data: jsonBody as Data };
      }
    } catch (error: any) {
      if (!error.response) throw error;
      throw new Error(
        JSON.stringify({ error: error.response.error as Record<string, string>, body }, null, 4),
      );
    }
  }

  async stream({
    path: reqPath,
    query,
    contentType = 'text/csv',
    maxTimeAllowed,
    stream,
  }: {
    path: string;
    query?: Record<string, unknown>;
    contentType: 'text/csv';
    maxTimeAllowed?: number;
    stream: WriteStream;
  }): Promise<void> {
    const url = new URL(`${this.baseUrl}${HttpRequester.escapeUrlSlug(reqPath)}`).toString();

    return new Promise<void>((resolve, reject) => {
      superagent
        .get(url)
        .timeout(maxTimeAllowed ?? 10_000)
        .set('Authorization', `Bearer ${this.token}`)
        .set('Accept', contentType)
        .query({ timezone: 'Europe/Paris', ...query })

        .pipe(stream)
        .on('finish', () => {
          resolve();
        })
        .on('error', err => {
          console.error('Error occurred while streaming response:', err);
          reject(err);
        });
    });
  }

  static escapeUrlSlug(name: string): string {
    return encodeURI(name).replace(/([+?*])/g, '\\$1');
  }
}
