// agent-client concatenates the request path directly onto this URL, so a query string or fragment
// would swallow it — reject them, and return the parsed, trailing-slash-free form.
export default function normalizeAgentUrl(agentUrl?: string): string | undefined {
  if (!agentUrl) return undefined;

  let parsed: URL;

  try {
    parsed = new URL(agentUrl);
  } catch {
    throw new Error(`Invalid agentUrl "${agentUrl}": it must be an absolute http(s) URL.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid agentUrl "${agentUrl}": only http and https are supported.`);
  }

  if (parsed.search || parsed.hash) {
    throw new Error(
      `Invalid agentUrl "${agentUrl}": it must not contain a query string or fragment.`,
    );
  }

  return parsed.href.replace(/\/+$/, '');
}
