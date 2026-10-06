const WEB_PROTOCOLS = ['https:', 'http:'];

function isUriOnAllowedDomain(redirectUri: string, allowedDomains: string[]): boolean {
  let hostname: string;
  let protocol: string;

  try {
    ({ hostname, protocol } = new URL(redirectUri));
  } catch {
    return false;
  }

  if (!WEB_PROTOCOLS.includes(protocol)) return false;

  return allowedDomains.some(domain => {
    const allowedDomain = domain.toLowerCase();

    return hostname === allowedDomain || hostname.endsWith(`.${allowedDomain}`);
  });
}

export default function isClientAllowed(
  redirectUris: string[] | undefined,
  allowedDomains: string[],
): boolean {
  const uris = redirectUris ?? [];

  return uris.length > 0 && uris.every(uri => isUriOnAllowedDomain(uri, allowedDomains));
}
