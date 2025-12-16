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
