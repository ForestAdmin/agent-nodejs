import AiProxyTimeoutError from './ai-proxy-timeout-error';

export { default as AiProxyTimeoutError } from './ai-proxy-timeout-error';

const AI_NAME = 'zendesk';
const AI_QUERY_PATH = '/api/ai-proxy/ai-query';
const JSON_CONTENT_TYPE = 'application/json';
const TIMEOUT_ERROR_NAME = 'TimeoutError';

function isTimeout(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  return (error as { name?: unknown }).name === TIMEOUT_ERROR_NAME;
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
  unparseableBodyError?: unknown;
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
      if (isTimeout(error)) throw new AiProxyTimeoutError(error);
      throw error;
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    const declaresJson = contentType.includes(JSON_CONTENT_TYPE);

    if (!declaresJson) return { status: response.status, body: undefined, isJson: false };

    try {
      return { status: response.status, body: await response.json(), isJson: true };
    } catch (error) {
      if (isTimeout(error)) throw new AiProxyTimeoutError(error);

      return {
        status: response.status,
        body: undefined,
        isJson: false,
        unparseableBodyError: error,
      };
    }
  }
}
