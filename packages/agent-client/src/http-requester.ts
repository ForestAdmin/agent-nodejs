import type { WriteStream } from 'fs';

import { Deserializer } from 'jsonapi-serializer';
import superagent from 'superagent';

import AgentHttpError from './errors';

function parseJson(text: string | undefined): unknown {
  if (text === undefined) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export default class HttpRequester {
  protected readonly deserializer: Deserializer;

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

  // Any transport reaching the agent must build this exact AgentHttpError shape — the approval-gate
  // detection in domains/action.ts routes on it. Shared with in-process transports via subclassing.
  protected buildError(status: number, body: unknown, text?: string): AgentHttpError {
    const hasBody = !!body && typeof body === 'object' && Object.keys(body).length > 0;

    return new AgentHttpError(status, hasBody ? body : parseJson(text), text);
  }

  protected async deserialize<Data>(
    body: unknown,
    text: string | undefined,
    skipDeserialization?: boolean,
  ): Promise<Data> {
    if (skipDeserialization) return body as Data;

    try {
      return (await this.deserializer.deserialize(body)) as Data;
    } catch {
      return (body ?? text) as Data;
    }
  }

  async query<Data = unknown>({
    method,
    path,
    body,
    query,
    maxTimeAllowed,
    contentType,
    skipDeserialization,
  }: {
    method: 'get' | 'post' | 'put' | 'delete';
    path: string;
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    maxTimeAllowed?: number;
    contentType?: 'application/json' | 'text/csv';
    skipDeserialization?: boolean;
  }): Promise<Data> {
    try {
      const url = this.buildUrl(path);

      const req = superagent[method](url)
        .timeout(maxTimeAllowed ?? 10_000)
        .set('Authorization', `Bearer ${this.token}`)
        .set('Content-Type', contentType ?? 'application/json')
        .set('Accept', contentType ?? 'application/json')
        .query({ timezone: 'Europe/Paris', ...query });

      if (body) req.send(body);

      const response = await req;

      return await this.deserialize<Data>(response.body, response.text, skipDeserialization);
    } catch (error) {
      const res = (error as { response?: { status?: number; body?: unknown; text?: string } })
        .response;
      if (!res) throw error; // network/timeout/abort → no HTTP response, propagate raw

      const text = typeof res.text === 'string' ? res.text : undefined;

      throw this.buildError(res.status ?? 0, res.body, text);
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
    const url = this.buildUrl(reqPath);

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

  static is404Error(error: unknown): boolean {
    return error instanceof AgentHttpError && error.status === 404;
  }

  private buildUrl(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    return new URL(`${this.baseUrl}${HttpRequester.escapeUrlSlug(normalizedPath)}`).toString();
  }
}
