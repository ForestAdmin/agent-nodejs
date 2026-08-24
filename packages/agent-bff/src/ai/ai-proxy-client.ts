import AI_NAME from './ai-name';
import AiProxyTimeoutError from './ai-proxy-timeout-error';

export { default as AiProxyTimeoutError } from './ai-proxy-timeout-error';

const AI_QUERY_PATH = '/api/ai-proxy/ai-query';
const JSON_CONTENT_TYPE = 'application/json';

function isTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError';
}

export interface AiProxyClientOptions {
  forestServerUrl: string;
  timeoutMs: number;
}

export interface AiQueryParams {
  saasAccessToken: string;
  environmentId?: number;
  renderingId: number;
  body: unknown;
}

export interface AiProxyResponse {
  status: number;
  body: unknown;
  isJson: boolean;
}

export default class AiProxyClient {
  private readonly forestServerUrl: string;
  private readonly timeoutMs: number;

  constructor({ forestServerUrl, timeoutMs }: AiProxyClientOptions) {
    this.forestServerUrl = forestServerUrl;
    this.timeoutMs = timeoutMs;
  }

  private url(): string {
    const url = new URL(AI_QUERY_PATH, this.forestServerUrl);
    url.searchParams.set('ai-name', AI_NAME);

    return url.toString();
  }

  private static headers({ saasAccessToken, environmentId, renderingId }: AiQueryParams) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${saasAccessToken}`,
      'Content-Type': JSON_CONTENT_TYPE,
      'forest-rendering-id': String(renderingId),
    };

    if (environmentId !== undefined) headers['forest-environment-id'] = String(environmentId);

    return headers;
  }

  async query(params: AiQueryParams): Promise<AiProxyResponse> {
    let response: Response;

    try {
      response = await fetch(this.url(), {
        method: 'POST',
        headers: AiProxyClient.headers(params),
        body: JSON.stringify(params.body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (isTimeout(error)) throw new AiProxyTimeoutError();
      throw new Error('The Forest server could not be reached');
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    const declaresJson = contentType.includes(JSON_CONTENT_TYPE);

    if (!declaresJson) return { status: response.status, body: undefined, isJson: false };

    try {
      return { status: response.status, body: await response.json(), isJson: true };
    } catch (error) {
      if (isTimeout(error)) throw new AiProxyTimeoutError();

      return { status: response.status, body: undefined, isJson: false };
    }
  }
}
