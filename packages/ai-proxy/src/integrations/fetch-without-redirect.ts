import { AIToolUnprocessableError } from '../errors';

const MIN_REDIRECT_STATUS = 300;
const MAX_REDIRECT_STATUS = 399;

// The integration APIs never redirect, so a redirect is refused rather than followed to a URL
// that was never validated.
export default async function fetchWithoutRedirect(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const response = await fetch(url, { ...init, redirect: 'manual' });

  if (response.status >= MIN_REDIRECT_STATUS && response.status <= MAX_REDIRECT_STATUS) {
    throw new AIToolUnprocessableError(
      `Refused to follow a redirect (HTTP ${response.status}) from ${new URL(url).origin}`,
    );
  }

  return response;
}
